import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Float, useTexture } from "@react-three/drei";

import { clamp01 } from "../../utils/math.js";

export default function Photo({
  url,
  size = 3,
  name,
  onPick,
  externalRef = null,
  getProgress = null,
}) {
  const tex = useTexture(url);
  const meshRef = useRef();
  const scaleRef = useRef([size, size, 1]);
  const phaseRef = useRef(Math.random() * Math.PI * 2);
  const speedRef = useRef(0.25 + Math.random() * 0.15);
  const ampRef = useRef(0.06 + Math.random() * 0.03);
  const progressFnRef = useRef(() => 1);

  useEffect(() => {
    if (tex.image) {
      const aspect = (tex.image.width || 1) / (tex.image.height || 1);
      scaleRef.current = [size, size / aspect, 1];
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
    const node = meshRef.current;
    if (!node) return;
    const progress = clamp01(progressFnRef.current?.() ?? 1);
    const t = clock.getElapsedTime();
    const [baseX, baseY, baseZ] = scaleRef.current;
    const scalePulse = 1 + Math.sin(t * speedRef.current + phaseRef.current) * ampRef.current;
    const scaled = scalePulse * (progress > 0 ? progress : 0);
    node.scale.set(baseX * scaled, baseY * scaled, baseZ * scaled);
    node.visible = progress > 0.001;
  });

  return (
    <Float speed={1} rotationIntensity={0.25} floatIntensity={0.6}>
      <mesh
        ref={(node) => {
          meshRef.current = node;
          if (externalRef) externalRef.current = node;
        }}
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
