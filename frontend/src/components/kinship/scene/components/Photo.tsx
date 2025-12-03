import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";

import { clamp01 } from "../../utils/math";

const MAX_CONCURRENT_TEXTURES = 6;
const TEXTURE_CACHE = new Map<string, THREE.Texture>();
const FAILED_TEXTURES = new Set<string>();
const LOAD_QUEUE: Array<{
  url: string;
  resolve: (tex: THREE.Texture | null) => void;
  crossOrigin: string | null;
}> = [];
let activeLoads = 0;

const dequeueLoad = () => {
  if (activeLoads >= MAX_CONCURRENT_TEXTURES) return;
  const next = LOAD_QUEUE.shift();
  if (!next) return;
  activeLoads += 1;

  const loader = new THREE.TextureLoader();
  if (next.crossOrigin) {
    loader.setCrossOrigin(next.crossOrigin);
  }

  loader.load(
    next.url,
    (tex) => {
      activeLoads = Math.max(0, activeLoads - 1);
      TEXTURE_CACHE.set(next.url, tex);
      next.resolve(tex);
      dequeueLoad();
    },
    undefined,
    () => {
      activeLoads = Math.max(0, activeLoads - 1);
      FAILED_TEXTURES.add(next.url);
      next.resolve(null);
      dequeueLoad();
    },
  );
};

const loadTextureSafely = (url: string, crossOrigin: string | null): Promise<THREE.Texture | null> => {
  if (TEXTURE_CACHE.has(url)) {
    return Promise.resolve(TEXTURE_CACHE.get(url) || null);
  }
  if (FAILED_TEXTURES.has(url)) {
    return Promise.resolve(null);
  }

  return new Promise<THREE.Texture | null>((resolve) => {
    LOAD_QUEUE.push({ url, resolve, crossOrigin });
    dequeueLoad();
  });
};

interface PhotoProps {
  url: string;
  size?: number;
  name: string | number;
  onPick?: ((name: string | number) => void) | undefined;
  externalRef?: React.MutableRefObject<THREE.Mesh | null> | null;
  getProgress?: (() => number) | number | null;
}

export default function Photo({
  url,
  size = 3,
  name,
  onPick,
  externalRef = null,
  getProgress = null,
}: PhotoProps) {
  const [tex, setTex] = useState<THREE.Texture | null>(TEXTURE_CACHE.get(url) || null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const scaleRef = useRef<[number, number, number]>([size, size, 1]);
  const phaseRef = useRef(Math.random() * Math.PI * 2);
  const speedRef = useRef(0.25 + Math.random() * 0.15);
  const ampRef = useRef(0.06 + Math.random() * 0.03);
  const progressFnRef = useRef<() => number>(() => 1);

  useEffect(() => {
    const cached = TEXTURE_CACHE.get(url) || null;
    setTex(cached);
    if (cached) return;

    let cancelled = false;
    loadTextureSafely(url, "anonymous").then((texture) => {
      if (cancelled) return;
      setTex(texture);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => {
    const image = tex?.image as { width?: number; height?: number } | undefined;
    if (image && image.width && image.height) {
      const aspect = (image.width || 1) / (image.height || 1);
      scaleRef.current = [size, size / aspect, 1];
      if (meshRef.current) meshRef.current.scale.set(...scaleRef.current);
    }
  }, [tex, size]);

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
    if (!node || !tex) return;
    const progress = clamp01(progressFnRef.current?.() ?? 1);
    const t = clock.getElapsedTime();
    const [baseX, baseY, baseZ] = scaleRef.current;
    const scalePulse = 1 + Math.sin(t * speedRef.current + phaseRef.current) * ampRef.current;
    const scaled = scalePulse * (progress > 0 ? progress : 0);
    node.scale.set(baseX * scaled, baseY * scaled, baseZ * scaled);
    node.visible = progress > 0.001;
  });

  if (!tex) return null;

  return (
    <Float speed={1} rotationIntensity={0.25} floatIntensity={0.6}>
      <mesh
        ref={(node) => {
          meshRef.current = node;
          if (externalRef) {
            (externalRef as any).current = node;
          }
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
