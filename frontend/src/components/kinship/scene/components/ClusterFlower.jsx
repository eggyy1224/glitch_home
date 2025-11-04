import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useSpring } from "@react-spring/three";

import Photo from "./Photo.jsx";
import { onlyOffspring, levelsOnlyOffspring } from "../../utils/data.js";
import { makeRing, toVec3, wobblePosition, clamp01 } from "../../utils/math.js";

export default function ClusterFlower({ imagesBase, cluster, onPick }) {
  const group = useRef();
  const centerRef = useRef();
  const { data, anchor } = cluster;
  const original = data?.original_image || cluster.original || cluster.id;
  const parents = data?.parents || [];
  const siblings = data?.siblings || [];
  const children = data?.children || [];
  const ancestorsByLevel = data?.ancestors_by_level || [];
  const anchorVec = useMemo(() => toVec3(anchor), [anchor?.x, anchor?.y, anchor?.z]);

  const parentsRing = useMemo(
    () => makeRing(onlyOffspring(parents), 8, 3, 0.8, anchorVec),
    [parents, anchorVec],
  );
  const siblingsRing = useMemo(
    () => makeRing(onlyOffspring(siblings), 10, 0, 0.8, anchorVec),
    [siblings, anchorVec],
  );
  const childrenRing = useMemo(
    () => makeRing(onlyOffspring(children), 8, -3, 0.8, anchorVec),
    [children, anchorVec],
  );
  const ancestorRings = useMemo(() => {
    const rings = [];
    let baseRadius = 11;
    let baseY = 4;
    const lvls = levelsOnlyOffspring(ancestorsByLevel);
    for (let index = 0; index < lvls.length - 1; index += 1) {
      const names = lvls[index + 1] || [];
      rings.push(makeRing(names, baseRadius + index * 3, baseY + index * 1, 0.7, anchorVec));
    }
    return rings;
  }, [ancestorsByLevel, anchorVec]);

  const [springs, api] = useSpring(() => ({
    center: 0,
    parents: 0,
    siblings: 0,
    children: 0,
    ancestors: 0,
  }));

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

  const readSpring = (value, fallback = 0) => {
    if (!value || typeof value.get !== "function") return fallback;
    return value.get();
  };

  const getCenterProgress = () => clamp01(readSpring(springs.center, 0));
  const getParentProgress = () => clamp01(readSpring(springs.parents, 0));
  const getSiblingProgress = () => clamp01(readSpring(springs.siblings, 0));
  const getChildrenProgress = () => clamp01(readSpring(springs.children, 0));
  const getAncestorProgress = (ringIndex) => () => clamp01(readSpring(springs.ancestors, 0) - ringIndex);

  const parentRefs = useRef([]);
  const siblingRefs = useRef([]);
  const childRefs = useRef([]);
  const ancestorRefs = useRef([]);
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

    const updateNodes = (entries, baseAnchor) => {
      entries.forEach((entry, index) => {
        const ref = entry.meshRef?.current;
        if (!ref) return;
        const lineRef = entry.lineRef?.current;
        const raw = typeof entry.getProgress === "function" ? entry.getProgress(index) : entry.getProgress ?? 1;
        const factor = clamp01(Number.isFinite(raw) ? raw : 0);
        const wobble = wobblePosition(entry.basePos, t, entry.speed, entry.amp, index * 0.6).lerp(baseAnchor, 1 - factor);
        ref.position.copy(wobble);
        ref.visible = factor > 0.001;
        if (lineRef?.geometry) {
          lineRef.geometry.setFromPoints([baseAnchor, wobble]);
          lineRef.geometry.attributes.position.needsUpdate = true;
        }
        if (lineRef?.material) {
          lineRef.material.opacity = (entry.lineOpacity ?? 1) * factor;
          lineRef.material.transparent = true;
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
        const meshRef = React.createRef();
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
        const meshRef = React.createRef();
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
              const meshRef = React.createRef();
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
        const meshRef = React.createRef();
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
