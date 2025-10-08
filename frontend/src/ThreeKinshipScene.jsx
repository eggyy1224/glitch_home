import React, { useMemo, useRef, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Float, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { useSpring } from "@react-spring/three";

function Photo({ url, size = 3, position = [0, 0, 0], name, onPick, externalRef = null, getProgress = null }) {
  const tex = useTexture(url);
  const meshRef = useRef();
  const scaleRef = useRef([size, size, 1]);
  const phaseRef = useRef(Math.random() * Math.PI * 2);
  const speedRef = useRef(0.25 + Math.random() * 0.15);
  const ampRef = useRef(0.06 + Math.random() * 0.03); // 6%~9%
  const progressFnRef = useRef(() => 1);

  useEffect(() => {
    if (tex.image) {
      const a = (tex.image.width || 1) / (tex.image.height || 1);
      scaleRef.current = [size, size / a, 1];
      if (meshRef.current) meshRef.current.scale.set(...scaleRef.current);
    }
  }, [tex.image, size]);

  useEffect(() => {
    if (typeof getProgress === "function") {
      progressFnRef.current = getProgress;
    } else if (typeof getProgress === "number") {
      progressFnRef.current = () => getProgress;
    } else {
      progressFnRef.current = () => 1;
    }
  }, [getProgress]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const node = meshRef.current;
    if (!node) return;
    const progress = THREE.MathUtils.clamp(progressFnRef.current?.() ?? 1, 0, 1);
    const [bx, by, bz] = scaleRef.current;
    const s = 1 + Math.sin(t * speedRef.current + phaseRef.current) * ampRef.current;
    const scaled = s * (progress > 0 ? progress : 0);
    node.scale.set(bx * scaled, by * scaled, bz * scaled);
    node.visible = progress > 0.001;
  });

  return (
    <Float speed={1} rotationIntensity={0.25} floatIntensity={0.6}>
      <mesh
        ref={(node) => {
          meshRef.current = node;
          if (externalRef) externalRef.current = node;
        }}
        position={position}
        onClick={() => onPick?.(name)}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "default")}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={tex} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </Float>
  );
}

function SceneContent({ imagesBase, original, parents = [], children = [], siblings = [], ancestorsByLevel = [], onPick }) {
  const group = useRef();
  const mainPos = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  // 僅顯示可從 /generated_images 提供的 offspring_* 影像，避免 404 造成渲染錯誤
  const onlyOffspring = (arr) => (arr || []).filter((n) => typeof n === "string" && n.startsWith("offspring_"));
  const levelsOnlyOffspring = (levels) => (levels || []).map((lv) => onlyOffspring(lv));
  const ring = (names, radius, y = 0, jitter = 0.8) => {
    const N = Math.max(names.length, 1);
    return names.map((name, i) => {
      const t = (i / N) * Math.PI * 2;
      return {
        name,
        pos: new THREE.Vector3(
          Math.cos(t) * radius,
          y + Math.sin(i * 1.3) * 0.4 * jitter,
          Math.sin(t) * radius
        ),
      };
    });
  };

  const parentsRing = useMemo(() => ring(onlyOffspring(parents), 8, 3), [parents]);
  const siblingsRing = useMemo(() => ring(onlyOffspring(siblings), 10, 0), [siblings]);
  const childrenRing = useMemo(() => ring(onlyOffspring(children), 8, -3), [children]);
  const ancestorRings = useMemo(() => {
    // 從父母之上開始鋪外圈（level1=父母的父母），每層半徑+3, y 也逐層+1
    const rings = [];
    let baseRadius = 11; // 大於 siblings 的半徑
    let baseY = 4;       // 高於 parents 的高度
    const lvls = levelsOnlyOffspring(ancestorsByLevel);
    for (let i = 0; i < lvls.length - 1; i++) { // 減去 level0=直接父母
      const names = lvls[i + 1] || [];
      rings.push(ring(names, baseRadius + i * 3, baseY + i * 1));
    }
    return rings; // 陣列的每個元素是一個 nodes 陣列
  }, [ancestorsByLevel]);

  const [springs, api] = useSpring(() => ({ center: 0, parents: 0, siblings: 0, children: 0, ancestors: 0 }));

  useEffect(() => {
    let cancelled = false;
    api.stop();
    api.start({
      from: { center: 0, parents: 0, siblings: 0, children: 0, ancestors: 0 },
      config: { mass: 1.2, tension: 90, friction: 26 },
      to: async (next) => {
        await next({ center: 1, delay: 160 });
        if (cancelled) return;
        if (parentsRing.length) {
          await next({ parents: 1, delay: 220 });
          if (cancelled) return;
        }
        if (siblingsRing.length) {
          await next({ siblings: 1, delay: 220 });
          if (cancelled) return;
        }
        if (childrenRing.length) {
          await next({ children: 1, delay: 220 });
          if (cancelled) return;
        }
        if (ancestorRings.length) {
          for (let i = 0; i < ancestorRings.length; i++) {
            await next({ ancestors: i + 1, delay: 240 });
            if (cancelled) return;
          }
        } else {
          await next({ ancestors: 0 });
        }
      },
    });

    return () => {
      cancelled = true;
      api.stop();
    };
  }, [api, original, parentsRing.length, siblingsRing.length, childrenRing.length, ancestorRings.length]);

  const clamp01 = (v) => THREE.MathUtils.clamp(v, 0, 1);
  const readSpring = (value, fallback = 0) => (value && typeof value.get === "function" ? value.get() : fallback);
  const getCenterProgress = () => clamp01(readSpring(springs.center, 0));
  const getParentProgress = () => clamp01(readSpring(springs.parents, 0));
  const getSiblingProgress = () => clamp01(readSpring(springs.siblings, 0));
  const getChildrenProgress = () => clamp01(readSpring(springs.children, 0));
  const getAncestorProgress = (ringIdx) => () => clamp01(readSpring(springs.ancestors, 0) - ringIdx);

  // 有機漂移：讓非原圖節點做微幅噪聲運動，並即時更新連線兩端
  const parentRefs = useRef([]);
  const siblingRefs = useRef([]);
  const childRefs = useRef([]);
  const ancestorRefs = useRef([]); // 陣列中每一層是一個陣列
  parentRefs.current = [];
  siblingRefs.current = [];
  childRefs.current = [];
  ancestorRefs.current = ancestorRings.map(() => []);

  function wobblePosition(pos, t, speed = 0.2, amp = 0.4, phase = 0) {
    return new THREE.Vector3(
      pos.x + Math.sin(t * speed + phase + pos.z * 0.1) * amp,
      pos.y + Math.sin(t * (speed * 1.3) + phase + pos.x * 0.1) * amp * 0.4,
      pos.z + Math.cos(t * (speed * 0.9) + phase + pos.y * 0.1) * amp
    );
  }

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (group.current) group.current.rotation.y = t * 0.08;

    const updateNodes = (entries) => {
      entries.forEach((entry, idx) => {
        const ref = entry.meshRef?.current;
        const lineRef = entry.lineRef?.current;
        if (!ref) return;
        const raw = typeof entry.getProgress === "function" ? entry.getProgress(idx) : entry.getProgress ?? 1;
        const factor = clamp01(Number.isFinite(raw) ? raw : 0);
        const wobble = wobblePosition(entry.basePos, t, entry.speed, entry.amp, idx * 0.6).lerp(mainPos, 1 - factor);
        ref.position.copy(wobble);
        ref.visible = factor > 0.001;
        if (lineRef?.geometry) {
          lineRef.geometry.setFromPoints([mainPos, wobble]);
          lineRef.geometry.attributes.position.needsUpdate = true;
        }
        if (lineRef?.material) {
          lineRef.material.opacity = (entry.lineOpacity ?? 1) * factor;
          lineRef.material.transparent = true;
          lineRef.visible = factor > 0.001;
        }
      });
    };

    updateNodes(parentRefs.current);
    updateNodes(siblingRefs.current);
    ancestorRefs.current.forEach((layer) => updateNodes(layer));
    updateNodes(childRefs.current);
  });

  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight intensity={0.6} position={[5, 10, 7]} />
      <group ref={group}>
        <Photo url={`${imagesBase}${original}`} size={4.2} position={[0, 0, 0]} name={original} onPick={onPick} getProgress={getCenterProgress} />
        {parentsRing.map((n, idx) => {
          const meshRef = React.createRef();
          const lineRef = React.createRef();
          parentRefs.current.push({
            meshRef,
            lineRef,
            basePos: n.pos.clone(),
            speed: 0.2,
            amp: 0.5,
            lineOpacity: 0.8,
            getProgress: getParentProgress,
          });
          return (
            <group key={`p-${n.name}`}>
              <Photo
                url={`${imagesBase}${n.name}`}
                size={3.0}
                position={[n.pos.x, n.pos.y, n.pos.z]}
                name={n.name}
                onPick={onPick}
                externalRef={meshRef}
                getProgress={getParentProgress}
              />
              <line ref={lineRef}>
                <bufferGeometry attach="geometry" />
                <lineBasicMaterial attach="material" color="#ffd166" transparent opacity={0} />
              </line>
            </group>
          );
        })}
        {siblingsRing.map((n) => {
          const meshRef = React.createRef();
          const lineRef = React.createRef();
          siblingRefs.current.push({
            meshRef,
            lineRef,
            basePos: n.pos.clone(),
            speed: 0.25,
            amp: 0.6,
            lineOpacity: 0.4,
            getProgress: getSiblingProgress,
          });
          return (
            <group key={`s-${n.name}`}>
              <Photo
                url={`${imagesBase}${n.name}`}
                size={2.8}
                position={[n.pos.x, n.pos.y, n.pos.z]}
                name={n.name}
                onPick={onPick}
                externalRef={meshRef}
                getProgress={getSiblingProgress}
              />
              <line ref={lineRef}>
                <bufferGeometry attach="geometry" />
                <lineBasicMaterial attach="material" color="#44ccff" transparent opacity={0} />
              </line>
            </group>
          );
        })}
        {ancestorRings.map((ringNodes, idx) => {
          const ringProgress = getAncestorProgress(idx);
          return (
            <group key={`a-ring-${idx}`}>
              {ringNodes.map((n) => {
                const meshRef = React.createRef();
                const lineRef = React.createRef();
                if (!ancestorRefs.current[idx]) ancestorRefs.current[idx] = [];
                ancestorRefs.current[idx].push({
                  meshRef,
                  lineRef,
                  basePos: n.pos.clone(),
                  speed: 0.18,
                  amp: 0.5,
                  lineOpacity: 0.35,
                  getProgress: ringProgress,
                });
                return (
                  <group key={`a-${idx}-${n.name}`}>
                    <Photo
                      url={`${imagesBase}${n.name}`}
                      size={2.6}
                      position={[n.pos.x, n.pos.y, n.pos.z]}
                      name={n.name}
                      onPick={onPick}
                      externalRef={meshRef}
                      getProgress={ringProgress}
                    />
                    <line ref={lineRef}>
                      <bufferGeometry attach="geometry" />
                      <lineBasicMaterial attach="material" color="#ffaaee" transparent opacity={0} />
                    </line>
                  </group>
                );
              })}
            </group>
          );
        })}
        {childrenRing.map((n) => {
          const meshRef = React.createRef();
          const lineRef = React.createRef();
          childRefs.current.push({
            meshRef,
            lineRef,
            basePos: n.pos.clone(),
            speed: 0.22,
            amp: 0.6,
            lineOpacity: 0.8,
            getProgress: getChildrenProgress,
          });
          return (
            <group key={`c-${n.name}`}>
              <Photo
                url={`${imagesBase}${n.name}`}
                size={3.0}
                position={[n.pos.x, n.pos.y, n.pos.z]}
                name={n.name}
                onPick={onPick}
                externalRef={meshRef}
                getProgress={getChildrenProgress}
              />
              <line ref={lineRef}>
                <bufferGeometry attach="geometry" />
                <lineBasicMaterial attach="material" color="#06d6a0" transparent opacity={0} />
              </line>
            </group>
          );
        })}
      </group>
      <OrbitControls enableDamping makeDefault />
    </>
  );
}

export default function ThreeKinshipScene({ imagesBase, original, related, parents, children, siblings, ancestorsByLevel, onPick }) {
  return (
    <Canvas camera={{ fov: 55, position: [0, 3, 12] }} gl={{ antialias: true }} style={{ width: "100%", height: "100%", background: "#000" }}>
      <fogExp2 attach="fog" args={[0x000000, 0.035]} />
      <SceneContent
        key={original}
        imagesBase={imagesBase}
        original={original}
        parents={parents}
        children={children}
        siblings={siblings}
        ancestorsByLevel={ancestorsByLevel}
        onPick={onPick}
      />
    </Canvas>
  );
}
