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

function SceneContent({ imagesBase, original, related, onPick }) {
  const group = useRef();
  const mainPos = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const R = 8;
  const nodes = useMemo(() => {
    const N = Math.max(related.length, 1);
    return related.map((name, i) => {
      const t = (i / N) * Math.PI * 2;
      return {
        name,
        pos: new THREE.Vector3(Math.cos(t) * R, Math.sin(i * 1.3) * 0.8, Math.sin(t) * R),
      };
    });
  }, [related]);

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
        {nodes.map((n) => (
          <group key={n.name}>
            <Photo url={`${imagesBase}${n.name}`} size={3.0} position={[n.pos.x, n.pos.y, n.pos.z]} name={n.name} onPick={onPick} />
            <Line points={[[n.pos.x, n.pos.y, n.pos.z], [mainPos.x, mainPos.y, mainPos.z]]} color="#44ccff" transparent opacity={0.5} />
          </group>
        ))}
      </group>
      <OrbitControls enableDamping makeDefault />
    </>
  );
}

export default function ThreeKinshipScene({ imagesBase, original, related, onPick }) {
  return (
    <Canvas camera={{ fov: 55, position: [0, 3, 12] }} gl={{ antialias: true }} style={{ width: "100%", height: "100%", background: "#000" }}>
      <fogExp2 attach="fog" args={[0x000000, 0.035]} />
      <SceneContent imagesBase={imagesBase} original={original} related={related} onPick={onPick} />
    </Canvas>
  );
}


