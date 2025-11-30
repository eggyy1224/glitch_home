import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { SpringValue, useSpring } from "@react-spring/three";

import { KinshipCluster, KinshipOnPick, RingNode } from "../../../../types/kinship";
import Photo from "./Photo";
import { onlyOffspring, levelsOnlyOffspring } from "../../utils/data";
import { makeRing, toVec3, wobblePosition, clamp01 } from "../../utils/math";

interface ClusterFlowerProps {
  imagesBase: string;
  cluster: KinshipCluster;
  onPick?: KinshipOnPick;
}

type NodeEntry = {
  name: string;
  meshRef: React.MutableRefObject<THREE.Mesh | null>;
  basePos: THREE.Vector3;
  speed: number;
  amp: number;
  lineOpacity?: number;
  getProgress: ((index?: number) => number) | number;
  lineRef?: React.RefObject<
    THREE.Line<THREE.BufferGeometry, THREE.Material | THREE.Material[]>
  >;
};

export default function ClusterFlower({ imagesBase, cluster, onPick }: ClusterFlowerProps) {
  const group = useRef<THREE.Group | null>(null);
  const centerRef = useRef<THREE.Mesh | null>(null);
  const { data, anchor } = cluster;
  const originalRaw = data?.original_image || cluster.original || cluster.id;
  const original = String(originalRaw);
  const parents = data?.parents || [];
  const siblings = data?.siblings || [];
  const children = data?.children || [];
  const ancestorsByLevel = data?.ancestors_by_level || [];
  const anchorVec = useMemo(() => toVec3(anchor), [anchor?.x, anchor?.y, anchor?.z]);

  const parentsRing = useMemo<RingNode[]>(
    () => makeRing(onlyOffspring(parents), 8, 3, 0.8, anchorVec),
    [parents, anchorVec],
  );
  const siblingsRing = useMemo<RingNode[]>(
    () => makeRing(onlyOffspring(siblings), 10, 0, 0.8, anchorVec),
    [siblings, anchorVec],
  );
  const childrenRing = useMemo<RingNode[]>(
    () => makeRing(onlyOffspring(children), 8, -3, 0.8, anchorVec),
    [children, anchorVec],
  );
  const ancestorRings = useMemo<RingNode[][]>(() => {
    const rings: RingNode[][] = [];
    let baseRadius = 11;
    let baseY = 4;
    const lvls = levelsOnlyOffspring(ancestorsByLevel);
    for (let index = 0; index < lvls.length - 1; index += 1) {
      const names = lvls[index + 1] || [];
      rings.push(makeRing(names, baseRadius + index * 3, baseY + index * 1, 0.7, anchorVec));
    }
    return rings;
  }, [ancestorsByLevel, anchorVec]);

  const [springs, api] = useSpring<{
    center: number;
    parents: number;
    siblings: number;
    childRing: number;
    ancestors: number;
  }>(() => ({
    center: 0,
    parents: 0,
    siblings: 0,
    childRing: 0,
    ancestors: 0,
  }));

  useEffect(() => {
    let cancelled = false;
    api.stop();
    api.start({
      from: { center: 0, parents: 0, siblings: 0, childRing: 0, ancestors: 0 },
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
          await next({ childRing: 1, delay: 220 });
          if (cancelled) return;
        }
        if (ancestorRings.length) {
          for (let index = 0; index < ancestorRings.length; index += 1) {
            await next({ ancestors: index + 1, delay: 240 });
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
  }, [api, cluster.id, parentsRing.length, siblingsRing.length, childrenRing.length, ancestorRings.length]);

  const readSpring = (value: SpringValue<number> | undefined, fallback = 0) => {
    if (!value || typeof value.get !== "function") return fallback;
    return value.get();
  };

  const getCenterProgress = () => clamp01(readSpring(springs.center, 0));
  const getParentProgress = () => clamp01(readSpring(springs.parents, 0));
  const getSiblingProgress = () => clamp01(readSpring(springs.siblings, 0));
  const getChildrenProgress = () => clamp01(readSpring(springs.childRing, 0));
  const getAncestorProgress = (ringIndex: number) => () =>
    clamp01(readSpring(springs.ancestors, 0) - ringIndex);

  const parentRefs = useRef<NodeEntry[]>([]);
  const siblingRefs = useRef<NodeEntry[]>([]);
  const childRefs = useRef<NodeEntry[]>([]);
  const ancestorRefs = useRef<NodeEntry[][]>([]);
  parentRefs.current = [];
  siblingRefs.current = [];
  childRefs.current = [];
  ancestorRefs.current = ancestorRings.map(() => []);

  useEffect(() => {
    if (centerRef.current) {
      centerRef.current.position.set(anchorVec.x, anchorVec.y, anchorVec.z);
    }
  }, [anchorVec]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (group.current) group.current.rotation.y = t * 0.06;

    const updateNodes = (entries: NodeEntry[], baseAnchor: THREE.Vector3) => {
      entries.forEach((entry, index) => {
        const ref = entry.meshRef?.current;
        if (!ref) return;
        const lineRef = entry.lineRef?.current;
        const raw = typeof entry.getProgress === "function" ? entry.getProgress(index) : entry.getProgress ?? 1;
        const factor = clamp01(Number.isFinite(raw) ? (raw as number) : 0);
        const wobble = wobblePosition(entry.basePos, t, entry.speed, entry.amp, index * 0.6).lerp(baseAnchor, 1 - factor);
        ref.position.copy(wobble);
        ref.visible = factor > 0.001;
        if (lineRef?.geometry) {
          const geometry = lineRef.geometry as THREE.BufferGeometry & {
            setFromPoints?: (points: THREE.Vector3[]) => void;
          };
          geometry.setFromPoints?.([baseAnchor, wobble]);
          const positionAttr = geometry.getAttribute("position");
          if (positionAttr) positionAttr.needsUpdate = true;
        }
        if (lineRef?.material && !Array.isArray(lineRef.material)) {
          lineRef.material.opacity = (entry.lineOpacity ?? 1) * factor;
          lineRef.material.transparent = true;
        }
        if (lineRef) {
          lineRef.visible = factor > 0.001;
        }
      });
    };

    updateNodes(parentRefs.current, anchorVec);
    updateNodes(siblingRefs.current, anchorVec);
    ancestorRefs.current.forEach((layer) => updateNodes(layer, anchorVec));
    updateNodes(childRefs.current, anchorVec);
  });

  return (
    <group ref={group}>
      <Photo
        url={`${imagesBase}${original}`}
        size={4.2}
        name={original}
        onPick={onPick}
        externalRef={centerRef}
        getProgress={getCenterProgress}
      />
      {parentsRing.map((node) => {
        const meshRef: React.MutableRefObject<THREE.Mesh | null> = { current: null };
        parentRefs.current.push({
          name: node.name,
          meshRef,
          basePos: node.pos.clone(),
          speed: 0.2,
          amp: 0.5,
          lineOpacity: 0.8,
          getProgress: getParentProgress,
        });
        return (
          <group key={`p-${cluster.id}-${node.name}`}>
            <Photo
              url={`${imagesBase}${node.name}`}
              size={3.0}
              name={node.name}
              onPick={onPick}
              externalRef={meshRef}
              getProgress={getParentProgress}
            />
          </group>
        );
      })}
      {siblingsRing.map((node) => {
        const meshRef: React.MutableRefObject<THREE.Mesh | null> = { current: null };
        siblingRefs.current.push({
          name: node.name,
          meshRef,
          basePos: node.pos.clone(),
          speed: 0.25,
          amp: 0.6,
          lineOpacity: 0.4,
          getProgress: getSiblingProgress,
        });
        return (
          <group key={`s-${cluster.id}-${node.name}`}>
            <Photo
              url={`${imagesBase}${node.name}`}
              size={2.8}
              name={node.name}
              onPick={onPick}
              externalRef={meshRef}
              getProgress={getSiblingProgress}
            />
          </group>
        );
      })}
      {ancestorRings.map((ringNodes, index) => {
        const ringProgress = getAncestorProgress(index);
        return (
          <group key={`a-ring-${cluster.id}-${index}`}>
            {ringNodes.map((node) => {
              const meshRef: React.MutableRefObject<THREE.Mesh | null> = { current: null };
              if (!ancestorRefs.current[index]) ancestorRefs.current[index] = [];
              ancestorRefs.current[index].push({
                name: node.name,
                meshRef,
                basePos: node.pos.clone(),
                speed: 0.18,
                amp: 0.5,
                lineOpacity: 0.35,
                getProgress: ringProgress,
              });
              return (
                <group key={`a-${cluster.id}-${index}-${node.name}`}>
                  <Photo
                    url={`${imagesBase}${node.name}`}
                    size={2.6}
                    name={node.name}
                    onPick={onPick}
                    externalRef={meshRef}
                    getProgress={ringProgress}
                  />
                </group>
              );
            })}
          </group>
        );
      })}
      {childrenRing.map((node) => {
        const meshRef: React.MutableRefObject<THREE.Mesh | null> = { current: null };
        childRefs.current.push({
          name: node.name,
          meshRef,
          basePos: node.pos.clone(),
          speed: 0.22,
          amp: 0.6,
          lineOpacity: 0.8,
          getProgress: getChildrenProgress,
        });
        return (
          <group key={`c-${cluster.id}-${node.name}`}>
            <Photo
              url={`${imagesBase}${node.name}`}
              size={3.0}
              name={node.name}
              onPick={onPick}
              externalRef={meshRef}
              getProgress={getChildrenProgress}
            />
          </group>
        );
      })}
    </group>
  );
}
