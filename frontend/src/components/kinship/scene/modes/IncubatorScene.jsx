import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Line, useTexture } from "@react-three/drei";
import { a, useSpring } from "@react-spring/three";

import Photo from "../components/Photo.jsx";
import {
  FLOW_TINTS,
  INCUBATOR_PARTICLE_COUNT,
  INCUBATOR_LONG_CYCLE,
} from "../../utils/constants.js";
import { buildLineageGraph } from "../../utils/graph.js";
import { createIncubatorEdges, createIncubatorLayout } from "../../utils/layouts.js";
import { clamp01, easeOutCubic, seededRandom } from "../../utils/math.js";

function IncubatorMist({ fieldRef }) {
  const configs = useMemo(() => {
    const entries = [];
    for (let index = 0; index < INCUBATOR_PARTICLE_COUNT; index += 1) {
      entries.push({
        radius: 8 + Math.random() * 14,
        baseAngle: Math.random() * Math.PI * 2,
        speed: 0.03 + Math.random() * 0.065,
        verticalSpeed: 0.35 + Math.random() * 0.65,
        height: (Math.random() - 0.5) * 12,
        scale: 0.16 + Math.random() * 0.14,
        scaleSpeed: 0.6 + Math.random() * 0.9,
        seed: Math.random() * Math.PI * 2,
      });
    }
    return entries;
  }, []);
  const instancedRef = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }) => {
    if (!instancedRef.current) return;
    const t = clock.getElapsedTime();
    const flow = fieldRef?.current ?? 0.6;
    configs.forEach((cfg, index) => {
      const angle = cfg.baseAngle + t * cfg.speed;
      const radius = cfg.radius + Math.sin(t * 0.22 + cfg.seed) * (0.4 + flow * 0.8);
      const y = cfg.height + Math.sin(t * cfg.verticalSpeed + cfg.seed) * (0.6 + flow * 0.9);
      dummy.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      const scale =
        cfg.scale *
        (0.65 + flow * 0.6 + Math.sin(t * cfg.scaleSpeed + cfg.seed) * 0.3 * (0.5 + flow * 0.5));
      dummy.scale.setScalar(scale);
      dummy.rotation.y = angle;
      dummy.rotation.z = angle * 0.18;
      dummy.updateMatrix();
      instancedRef.current.setMatrixAt(index, dummy.matrix);
    });
    instancedRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={instancedRef} args={[null, null, configs.length]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshStandardMaterial
        color="#1a5e7a"
        transparent
        opacity={0.22}
        emissive="#1d628f"
        emissiveIntensity={0.55}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

function FlowOverlay({ url, baseRef, getProgress, kind, flowRef, seed }) {
  const overlayRef = useRef();
  const tex = useTexture(url);
  const color = useMemo(() => new THREE.Color(FLOW_TINTS[kind] || "#b4cffd"), [kind]);
  const [springs, api] = useSpring(() => ({
    opacity: 0,
    config: { mass: 1, tension: 38, friction: 18 },
  }));
  const lastOpacity = useRef(0);

  useEffect(() => {
    tex.wrapS = tex.wrapT = THREE.MirroredRepeatWrapping;
    tex.needsUpdate = true;
  }, [tex]);

  useFrame(({ clock }) => {
    const baseMesh = baseRef.current;
    const overlayMesh = overlayRef.current;
    if (!baseMesh || !overlayMesh) return;

    const t = clock.getElapsedTime();
    const progress = clamp01(getProgress?.() ?? 0);
    const globalFlow = flowRef.current ?? 0.6;
    const eased = progress * progress;
    const driftSpeed = 0.08 + 0.05 * eased;
    const drift = 0.35 + 0.45 * eased;
    const phase = seed * 6.28 + t * driftSpeed;

    overlayMesh.position.copy(baseMesh.position);
    overlayMesh.position.x += Math.sin(phase) * drift;
    overlayMesh.position.y += Math.cos(phase * 0.8) * drift * 0.4;
    overlayMesh.position.z += Math.sin(phase * 0.6) * drift * 0.3;

    const scalePulse = 1.05 + Math.sin(phase * 0.6) * 0.06 + eased * 0.15;
    overlayMesh.scale.set(
      baseMesh.scale.x * scalePulse,
      baseMesh.scale.y * scalePulse,
      baseMesh.scale.z,
    );

    const targetOpacity = progress > 0.04 ? (0.1 + eased * 0.35) * (0.4 + globalFlow * 0.6) : 0;
    if (Math.abs(targetOpacity - lastOpacity.current) > 0.01) {
      api.start({ opacity: targetOpacity });
      lastOpacity.current = targetOpacity;
    }
    overlayMesh.visible = targetOpacity > 0.01;
  });

  return (
    <a.mesh ref={overlayRef}>
      <planeGeometry args={[1, 1]} />
      <a.meshBasicMaterial
        transparent
        toneMapped={false}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        map={tex}
        color={color}
        opacity={springs.opacity}
      />
    </a.mesh>
  );
}

export default function IncubatorScene({ imagesBase, data, onPick }) {
  const graph = useMemo(() => buildLineageGraph(data), [data]);
  const nodes = useMemo(() => createIncubatorLayout(graph), [graph]);
  const edges = useMemo(() => createIncubatorEdges(graph, nodes), [graph, nodes]);

  const groupRef = useRef();
  const backgroundRef = useRef();
  const spawnStart = useRef(null);
  const nodeEntriesRef = useRef([]);
  const nodeLookupRef = useRef(new Map());
  const edgeEntriesRef = useRef([]);
  const quantumFieldIntensityRef = useRef(0.6);

  nodeEntriesRef.current = [];
  nodeLookupRef.current = new Map();
  edgeEntriesRef.current = [];

  const nodeElements = nodes.map((node) => {
    const meshRef = React.createRef();
    const progressRef = { current: 0 };
    const entry = { node, meshRef, progressRef };
    nodeEntriesRef.current.push(entry);
    nodeLookupRef.current.set(node.name, entry);

    const progressFn = () => progressRef.current;
    const size =
      node.kind === "original"
        ? 4.4
        : node.kind === "parent"
        ? 3.6
        : node.kind === "child"
        ? 3.4
        : node.kind === "sibling"
        ? 3.0
        : 2.8;

    const flowSeed = seededRandom(node.name, 31);

    return (
      <group key={`inc-node-${node.name}`}>
        <Photo
          url={`${imagesBase}${node.name}`}
          size={size}
          name={node.name}
          onPick={onPick}
          externalRef={meshRef}
          getProgress={progressFn}
        />
        <FlowOverlay
          url={`${imagesBase}${node.name}`}
          baseRef={meshRef}
          getProgress={progressFn}
          kind={node.kind}
          flowRef={quantumFieldIntensityRef}
          seed={flowSeed}
        />
      </group>
    );
  });

  const edgeElements = edges
    .map((edge, index) => {
      const sourceEntry = nodeLookupRef.current.get(edge.source.name);
      const targetEntry = nodeLookupRef.current.get(edge.target.name);
      if (!sourceEntry || !targetEntry) return null;
      const lineRef = React.createRef();
      edgeEntriesRef.current.push({
        lineRef,
        sourceEntry,
        targetEntry,
        baseOpacity: edge.baseOpacity,
      });
      return (
        <Line
          key={`inc-edge-${edge.source.name}-${edge.target.name}-${index}`}
          ref={lineRef}
          points={[
            [0, 0, 0],
            [0, 0, 0],
          ]}
          color="#6ea7ff"
          lineWidth={1.2}
          transparent
          opacity={0}
          depthTest={false}
        />
      );
    })
    .filter(Boolean);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (spawnStart.current === null) {
      spawnStart.current = t;
    }
    const elapsed = t - spawnStart.current;
    let progressSum = 0;
    let progressCount = 0;

    nodeEntriesRef.current.forEach((entry) => {
      const { node, meshRef, progressRef } = entry;
      const mesh = meshRef.current;
      if (!mesh) return;
      const local = elapsed - node.spawnDelay;
      const progress = local > 0 ? Math.min(local / node.growthDuration, 1) : 0;
      const eased = easeOutCubic(progress);
      progressRef.current = eased;
      const radial = node.radius * eased;
      const spin = node.angle + node.orbitSpeed * t * (0.8 + eased * 0.6);
      const wobble = node.wobbleAmp * eased * Math.sin(t * node.wobbleSpeed + node.floatPhase);
      const x =
        Math.cos(spin) * radial +
        Math.cos(t * node.floatSpeed * 0.6 + node.floatPhase) * wobble * 0.32;
      const z =
        Math.sin(spin) * radial +
        Math.sin(t * node.floatSpeed * 0.6 + node.floatPhase) * wobble * 0.32;
      const y =
        THREE.MathUtils.lerp(0, node.baseY, eased) +
        Math.sin(t * node.floatSpeed + node.floatPhase) *
          node.floatAmp *
          0.35 *
          (0.6 + eased * 0.5);
      mesh.position.set(x, y, z);
      mesh.visible = eased > 0.015;
      if (eased > 0) {
        progressSum += eased;
        progressCount += 1;
      }
    });

    edgeEntriesRef.current.forEach((entry) => {
      const line = entry.lineRef.current;
      const sourceMesh = entry.sourceEntry.meshRef.current;
      const targetMesh = entry.targetEntry.meshRef.current;
      if (!line || !sourceMesh || !targetMesh) return;
      const visibility = Math.min(
        entry.sourceEntry.progressRef.current,
        entry.targetEntry.progressRef.current,
      );
      line.geometry.setFromPoints([sourceMesh.position, targetMesh.position]);
      if (line.material) {
        const flowMod = 0.4 + (quantumFieldIntensityRef.current ?? 0.6) * 0.6;
        line.material.opacity = visibility * entry.baseOpacity * flowMod;
        line.material.transparent = true;
      }
      line.visible = visibility > 0.08;
    });

    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(elapsed * 0.1) * 0.12;
      groupRef.current.rotation.x = Math.sin(elapsed * 0.05) * 0.035;
    }

    const averageProgress = progressCount > 0 ? progressSum / progressCount : 0;
    const longCycle = (Math.sin((elapsed / INCUBATOR_LONG_CYCLE) * Math.PI * 2) + 1) / 2;
    quantumFieldIntensityRef.current = clamp01(averageProgress * 0.6 + longCycle * 0.4);

    const bg = backgroundRef.current;
    if (bg?.material) {
      const flow = quantumFieldIntensityRef.current;
      bg.material.emissiveIntensity = 0.4 + flow * 0.4;
      bg.material.opacity = 0.26 + flow * 0.1;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh ref={backgroundRef} scale={[34, 34, 34]}>
        <sphereGeometry args={[1, 48, 48]} />
        <meshStandardMaterial
          color="#040a16"
          transparent
          opacity={0.32}
          side={THREE.BackSide}
          emissive="#0b203a"
          emissiveIntensity={0.55}
        />
      </mesh>
      <IncubatorMist fieldRef={quantumFieldIntensityRef} />
      {edgeElements}
      {nodeElements}
    </group>
  );
}
