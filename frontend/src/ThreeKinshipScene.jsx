import React, { useMemo, useRef, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Float, Line, useTexture } from "@react-three/drei";
import * as THREE from "three";

function Photo({ url, size = 3, position = [0, 0, 0], name, onPick }) {
  const tex = useTexture(url);
  const meshRef = useRef();
  const scaleRef = useRef([size, size, 1]);

  useEffect(() => {
    if (tex.image) {
      const a = (tex.image.width || 1) / (tex.image.height || 1);
      scaleRef.current = [size, size / a, 1];
      if (meshRef.current) meshRef.current.scale.set(...scaleRef.current);
    }
  }, [tex.image, size]);

  return (
    <Float speed={1} rotationIntensity={0.25} floatIntensity={0.6}>
      <mesh
        ref={meshRef}
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

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (group.current) group.current.rotation.y = t * 0.12;
  });

  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight intensity={0.6} position={[5, 10, 7]} />
      <group ref={group}>
        <Photo url={`${imagesBase}${original}`} size={4.2} position={[0, 0, 0]} name={original} onPick={onPick} />
        {parentsRing.map((n) => (
          <group key={`p-${n.name}`}>
            <Photo url={`${imagesBase}${n.name}`} size={3.0} position={[n.pos.x, n.pos.y, n.pos.z]} name={n.name} onPick={onPick} />
            <Line points={[[n.pos.x, n.pos.y, n.pos.z], [mainPos.x, mainPos.y, mainPos.z]]} color="#ffd166" transparent opacity={0.8} />
          </group>
        ))}
        {siblingsRing.map((n) => (
          <group key={`s-${n.name}`}>
            <Photo url={`${imagesBase}${n.name}`} size={2.8} position={[n.pos.x, n.pos.y, n.pos.z]} name={n.name} onPick={onPick} />
            <Line points={[[n.pos.x, n.pos.y, n.pos.z], [mainPos.x, mainPos.y, mainPos.z]]} color="#44ccff" transparent opacity={0.4} />
          </group>
        ))}
        {ancestorRings.map((ringNodes, idx) => (
          <group key={`a-ring-${idx}`}>
            {ringNodes.map((n) => (
              <group key={`a-${idx}-${n.name}`}>
                <Photo url={`${imagesBase}${n.name}`} size={2.6} position={[n.pos.x, n.pos.y, n.pos.z]} name={n.name} onPick={onPick} />
                <Line points={[[n.pos.x, n.pos.y, n.pos.z], [mainPos.x, mainPos.y, mainPos.z]]} color="#ffaaee" transparent opacity={0.35} />
              </group>
            ))}
          </group>
        ))}
        {childrenRing.map((n) => (
          <group key={`c-${n.name}`}>
            <Photo url={`${imagesBase}${n.name}`} size={3.0} position={[n.pos.x, n.pos.y, n.pos.z]} name={n.name} onPick={onPick} />
            <Line points={[[n.pos.x, n.pos.y, n.pos.z], [mainPos.x, mainPos.y, mainPos.z]]} color="#06d6a0" transparent opacity={0.8} />
          </group>
        ))}
      </group>
      <OrbitControls enableDamping makeDefault />
    </>
  );
}

export default function ThreeKinshipScene({ imagesBase, original, related, parents, children, siblings, ancestorsByLevel, onPick }) {
  return (
    <Canvas camera={{ fov: 55, position: [0, 3, 12] }} gl={{ antialias: true }} style={{ width: "100%", height: "100%", background: "#000" }}>
      <fogExp2 attach="fog" args={[0x000000, 0.035]} />
      <SceneContent imagesBase={imagesBase} original={original} parents={parents} children={children} siblings={siblings} ancestorsByLevel={ancestorsByLevel} onPick={onPick} />
    </Canvas>
  );
}


