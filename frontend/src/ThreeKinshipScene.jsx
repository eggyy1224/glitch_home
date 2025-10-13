import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Float, useTexture, Line, Billboard } from "@react-three/drei";
import * as THREE from "three";
import { a, useSpring } from "@react-spring/three";

const onlyOffspring = (arr) => (arr || []).filter((n) => typeof n === "string" && n.startsWith("offspring_"));
const levelsOnlyOffspring = (levels) => (levels || []).map((lv) => onlyOffspring(lv));
const clamp01 = (value) => THREE.MathUtils.clamp(value, 0, 1);

const toVec3 = (anchor) => new THREE.Vector3(anchor?.x || 0, anchor?.y || 0, anchor?.z || 0);

const makeRing = (names, radius, yOffset, jitter, center) => {
  const N = Math.max(names.length, 1);
  return names.map((name, i) => {
    const t = (i / N) * Math.PI * 2;
    return {
      name,
      pos: new THREE.Vector3(
        center.x + Math.cos(t) * radius,
        center.y + yOffset + Math.sin(i * 1.3) * 0.4 * jitter,
        center.z + Math.sin(t) * radius
      ),
    };
  });
};

const wobblePosition = (pos, t, speed = 0.2, amp = 0.4, phase = 0) =>
  new THREE.Vector3(
    pos.x + Math.sin(t * speed + phase + pos.z * 0.1) * amp,
    pos.y + Math.sin(t * (speed * 1.3) + phase + pos.x * 0.1) * amp * 0.4,
    pos.z + Math.cos(t * (speed * 0.9) + phase + pos.y * 0.1) * amp
  );

const KIND_PRIORITY = {
  original: 0,
  parent: 1,
  child: 1,
  sibling: 2,
  ancestor: 3,
};

const KIND_COLORS = {
  original: "#88c0ff",
  parent: "#ffb347",
  child: "#a7ff83",
  sibling: "#d291ff",
  ancestor: "#ffd166",
};

const PHYLO_LEVEL_GAP = 7.5;
const PHYLO_NODE_SPACING = 6.2;
const PHYLO_NODE_BASE_SIZE = 3.4;

const defaultGraph = { nodes: [], edges: [] };

const sanitizeGraph = (graphInput, data) => {
  const graph = graphInput || {};
  const rawNodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const rawEdges = Array.isArray(graph.edges) ? graph.edges : [];

  const nodes = [];
  const nodeLookup = new Map();

  rawNodes.forEach((node) => {
    if (!node || typeof node.name !== "string") return;
    const name = node.name;
    const level = Number.isFinite(node.level) ? node.level : 0;
    const kind = node.kind || (level === 0 ? "original" : level > 0 ? "child" : level === -1 ? "parent" : "ancestor");
    const normalized = { name, level, kind };
    nodes.push(normalized);
    nodeLookup.set(name, normalized);
  });

  if (!nodeLookup.has(data?.original_image)) {
    const fallbackOriginal = {
      name: data?.original_image,
      level: 0,
      kind: "original",
    };
    nodes.push(fallbackOriginal);
    nodeLookup.set(fallbackOriginal.name, fallbackOriginal);
  }

  const edges = [];
  const dedupe = new Set();

  rawEdges.forEach((edge) => {
    if (!edge) return;
    const source = typeof edge.source === "string" ? edge.source : null;
    const target = typeof edge.target === "string" ? edge.target : null;
    if (!source || !target) return;
    if (!nodeLookup.has(source) || !nodeLookup.has(target)) return;
    const key = `${source}->${target}`;
    if (dedupe.has(key)) return;
    dedupe.add(key);
    edges.push({ source, target });
  });

  return { nodes, edges };
};

const buildFallbackGraph = (data) => {
  if (!data) return defaultGraph;
  const nodes = [];
  const edges = [];
  const seen = new Map();

  const upsert = (name, kind, level) => {
    if (!name) return;
    if (seen.has(name)) {
      const node = seen.get(name);
      if (level < node.level) node.level = level;
      if (KIND_PRIORITY[kind] < KIND_PRIORITY[node.kind]) node.kind = kind;
      return node;
    }
    const node = { name, kind, level };
    nodes.push(node);
    seen.set(name, node);
    return node;
  };

  const addEdge = (source, target) => {
    if (!source || !target) return;
    edges.push({ source, target });
  };

  const original = upsert(data.original_image, "original", 0);

  (data.parents || []).forEach((parent) => {
    upsert(parent, "parent", -1);
    addEdge(parent, original?.name);
  });

  (data.children || []).forEach((child) => {
    upsert(child, "child", 1);
    addEdge(original?.name, child);
  });

  (data.ancestors_by_level || []).forEach((levelNames, idx) => {
    const level = -(idx + 1);
    (levelNames || []).forEach((name) => {
      upsert(name, idx === 0 ? "parent" : "ancestor", level);
    });
    if (idx > 0) {
      const prevLevel = data.ancestors_by_level[idx - 1] || [];
      (levelNames || []).forEach((name) => {
        (prevLevel || []).forEach((prevName) => addEdge(name, prevName));
      });
    }
  });

  return { nodes, edges };
};

const buildLineageGraph = (data) => {
  if (!data) return defaultGraph;
  const graph = sanitizeGraph(data.lineage_graph, data);
  if (graph.nodes.length > 0) return graph;
  return buildFallbackGraph(data);
};

const MAX_INCUBATOR_NODES = 60;
const INCUBATOR_LEVEL_GAP = 4.6;
const INCUBATOR_BASE_RADIUS = 4.4;
const INCUBATOR_RADIUS_STEP = 3.3;

const seededRandom = (key, salt = 0) => {
  const str = `${key}:${salt}`;
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const x = Math.sin(hash) * 43758.5453;
  return x - Math.floor(x);
};

const easeOutCubic = (t) => 1 - Math.pow(1 - clamp01(t), 3);

const createIncubatorLayout = (graph) => {
  if (!graph || !Array.isArray(graph.nodes) || graph.nodes.length === 0) return [];

  const nodesSorted = [...graph.nodes].sort((a, b) => {
    const pa = KIND_PRIORITY[a.kind] ?? 99;
    const pb = KIND_PRIORITY[b.kind] ?? 99;
    if (pa !== pb) return pa - pb;
    const la = Number.isFinite(a.level) ? a.level : 0;
    const lb = Number.isFinite(b.level) ? b.level : 0;
    if (la !== lb) return la - lb;
    return a.name.localeCompare(b.name);
  });

  const limited = nodesSorted.slice(0, MAX_INCUBATOR_NODES);

  const nodes = limited.map((node, idx) => {
    const level = Number.isFinite(node.level) ? node.level : 0;
    const kind = node.kind || (level === 0 ? "sibling" : level > 0 ? "child" : "ancestor");
    const absLevel = Math.abs(level);
    const seedBase = `${node.name}:${idx}`;
    const angle = seededRandom(seedBase, 1) * Math.PI * 2;

    const radiusMultiplier =
      kind === "original"
        ? 0
        : kind === "parent"
        ? 0.85
        : kind === "child"
        ? 0.95
        : kind === "sibling"
        ? 1.35
        : 1.4 + absLevel * 0.28;

    const radius =
      (INCUBATOR_BASE_RADIUS + absLevel * INCUBATOR_RADIUS_STEP) *
      radiusMultiplier *
      (0.85 + seededRandom(seedBase, 2) * 0.55);

    let baseY = 0;
    if (kind === "parent" || level < 0) {
      baseY =
        INCUBATOR_LEVEL_GAP * (absLevel + 0.35) * (0.9 + seededRandom(seedBase, 3) * 0.4);
    } else if (kind === "child" || level > 0) {
      baseY =
        -INCUBATOR_LEVEL_GAP * (absLevel + 0.35) * (0.9 + seededRandom(seedBase, 4) * 0.4);
    } else if (kind === "ancestor") {
      const direction = level < 0 ? 1 : -1;
      baseY =
        INCUBATOR_LEVEL_GAP * direction * (absLevel + 0.6) * (0.85 + seededRandom(seedBase, 5) * 0.5);
    } else {
      baseY = (seededRandom(seedBase, 6) - 0.5) * INCUBATOR_LEVEL_GAP * 0.8;
    }

    const orbitSpeed = 0.07 + seededRandom(seedBase, 7) * 0.16;
    const floatAmp = 0.65 + seededRandom(seedBase, 8) * 0.55;
    const floatSpeed = 0.55 + seededRandom(seedBase, 9) * 0.85;
    const floatPhase = seededRandom(seedBase, 10) * Math.PI * 2;
    const wobbleAmp = 0.5 + seededRandom(seedBase, 11) * 0.8;
    const wobbleSpeed = 0.25 + seededRandom(seedBase, 12) * 0.5;
    const growthDuration = 1.8 + seededRandom(seedBase, 13) * 1.3;

    return {
      ...node,
      kind,
      angle,
      radius,
      baseY,
      orbitSpeed,
      floatAmp,
      floatSpeed,
      floatPhase,
      wobbleAmp,
      wobbleSpeed,
      growthDuration,
      spawnDelay: 0,
    };
  });

  const groups = [
    { kinds: ["original"], step: 0.45, gapAfter: 0.6 },
    { kinds: ["parent"], step: 0.35, gapAfter: 0.9 },
    { kinds: ["child"], step: 0.32, gapAfter: 0.8 },
    { kinds: ["sibling"], step: 0.28, gapAfter: 0.7 },
    { kinds: ["ancestor"], step: 0.25, gapAfter: 0.65 },
  ];

  let cursor = 0;
  groups.forEach(({ kinds, step, gapAfter }) => {
    const subset = nodes.filter((node) => kinds.includes(node.kind));
    if (!subset.length) return;
    subset.forEach((node, index) => {
      node.spawnDelay = cursor + index * step;
    });
    cursor += gapAfter + subset.length * step * 0.25;
  });

  return nodes;
};

const createIncubatorEdges = (graph, layoutNodes) => {
  if (!graph || !Array.isArray(graph.edges) || !layoutNodes.length) return [];
  const lookup = new Map(layoutNodes.map((node) => [node.name, node]));
  const seen = new Set();
  return graph.edges
    .map((edge) => {
      const source = lookup.get(edge.source);
      const target = lookup.get(edge.target);
      if (!source || !target) return null;
      const key = `${source.name}->${target.name}`;
      if (seen.has(key)) return null;
      seen.add(key);
      const tight =
        source.kind === "original" ||
        target.kind === "original" ||
        (source.kind === "parent" && target.kind === "child") ||
        (source.kind === "child" && target.kind === "parent");
      const baseOpacity = tight ? 0.6 : 0.35;
      return { source, target, baseOpacity };
    })
    .filter(Boolean);
};

function Photo({ url, size = 3, name, onPick, externalRef = null, getProgress = null }) {
  const tex = useTexture(url);
  const meshRef = useRef();
  const scaleRef = useRef([size, size, 1]);
  const phaseRef = useRef(Math.random() * Math.PI * 2);
  const speedRef = useRef(0.25 + Math.random() * 0.15);
  const ampRef = useRef(0.06 + Math.random() * 0.03);
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
    const node = meshRef.current;
    if (!node) return;
    const progress = clamp01(progressFnRef.current?.() ?? 1);
    const t = clock.getElapsedTime();
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

function ClusterFlower({ imagesBase, cluster, onPick }) {
  const group = useRef();
  const centerRef = useRef();
  const { data, anchor } = cluster;
  const original = data?.original_image || cluster.original || cluster.id;
  const parents = data?.parents || [];
  const siblings = data?.siblings || [];
  const children = data?.children || [];
  const ancestorsByLevel = data?.ancestors_by_level || [];
  const anchorVec = useMemo(() => toVec3(anchor), [anchor?.x, anchor?.y, anchor?.z]);

  const parentsRing = useMemo(() => makeRing(onlyOffspring(parents), 8, 3, 0.8, anchorVec), [parents, anchorVec]);
  const siblingsRing = useMemo(() => makeRing(onlyOffspring(siblings), 10, 0, 0.8, anchorVec), [siblings, anchorVec]);
  const childrenRing = useMemo(() => makeRing(onlyOffspring(children), 8, -3, 0.8, anchorVec), [children, anchorVec]);
  const ancestorRings = useMemo(() => {
    const rings = [];
    let baseRadius = 11;
    let baseY = 4;
    const lvls = levelsOnlyOffspring(ancestorsByLevel);
    for (let i = 0; i < lvls.length - 1; i++) {
      const names = lvls[i + 1] || [];
      rings.push(makeRing(names, baseRadius + i * 3, baseY + i * 1, 0.7, anchorVec));
    }
    return rings;
  }, [ancestorsByLevel, anchorVec]);

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
  }, [api, cluster.id, parentsRing.length, siblingsRing.length, childrenRing.length, ancestorRings.length]);

  const readSpring = (value, fallback = 0) => {
    if (!value || typeof value.get !== "function") return fallback;
    return value.get();
  };

  const getCenterProgress = () => clamp01(readSpring(springs.center, 0));
  const getParentProgress = () => clamp01(readSpring(springs.parents, 0));
  const getSiblingProgress = () => clamp01(readSpring(springs.siblings, 0));
  const getChildrenProgress = () => clamp01(readSpring(springs.children, 0));
  const getAncestorProgress = (ringIdx) => () => clamp01(readSpring(springs.ancestors, 0) - ringIdx);

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
      entries.forEach((entry, idx) => {
        const ref = entry.meshRef?.current;
        if (!ref) return;
        const lineRef = entry.lineRef?.current;
        const raw = typeof entry.getProgress === "function" ? entry.getProgress(idx) : entry.getProgress ?? 1;
        const factor = clamp01(Number.isFinite(raw) ? raw : 0);
        const wobble = wobblePosition(entry.basePos, t, entry.speed, entry.amp, idx * 0.6).lerp(baseAnchor, 1 - factor);
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
      {parentsRing.map((n) => {
        const meshRef = React.createRef();
        parentRefs.current.push({
          name: n.name,
          meshRef,
          basePos: n.pos.clone(),
          speed: 0.2,
          amp: 0.5,
          lineOpacity: 0.8,
          getProgress: getParentProgress,
        });
        return (
          <group key={`p-${cluster.id}-${n.name}`}>
            <Photo
              url={`${imagesBase}${n.name}`}
              size={3.0}
              name={n.name}
              onPick={onPick}
              externalRef={meshRef}
              getProgress={getParentProgress}
            />
          </group>
        );
      })}
      {siblingsRing.map((n) => {
        const meshRef = React.createRef();
        siblingRefs.current.push({
          name: n.name,
          meshRef,
          basePos: n.pos.clone(),
          speed: 0.25,
          amp: 0.6,
          lineOpacity: 0.4,
          getProgress: getSiblingProgress,
        });
        return (
          <group key={`s-${cluster.id}-${n.name}`}>
            <Photo
              url={`${imagesBase}${n.name}`}
              size={2.8}
              name={n.name}
              onPick={onPick}
              externalRef={meshRef}
              getProgress={getSiblingProgress}
            />
          </group>
        );
      })}
      {ancestorRings.map((ringNodes, idx) => {
        const ringProgress = getAncestorProgress(idx);
        return (
          <group key={`a-ring-${cluster.id}-${idx}`}>
            {ringNodes.map((n) => {
              const meshRef = React.createRef();
              if (!ancestorRefs.current[idx]) ancestorRefs.current[idx] = [];
              ancestorRefs.current[idx].push({
                name: n.name,
                meshRef,
                basePos: n.pos.clone(),
                speed: 0.18,
                amp: 0.5,
                lineOpacity: 0.35,
                getProgress: ringProgress,
              });
              return (
                <group key={`a-${cluster.id}-${idx}-${n.name}`}>
                  <Photo
                    url={`${imagesBase}${n.name}`}
                    size={2.6}
                    name={n.name}
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
      {childrenRing.map((n) => {
        const meshRef = React.createRef();
        childRefs.current.push({
          name: n.name,
          meshRef,
          basePos: n.pos.clone(),
          speed: 0.22,
          amp: 0.6,
          lineOpacity: 0.8,
          getProgress: getChildrenProgress,
        });
        return (
          <group key={`c-${cluster.id}-${n.name}`}>
            <Photo
              url={`${imagesBase}${n.name}`}
              size={3.0}
              name={n.name}
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

function SceneContent({ imagesBase, clusters = [], onPick }) {
  return (
    <>
      {clusters.map((cluster) => (
        <ClusterFlower
          key={cluster.id}
          cluster={cluster}
          imagesBase={imagesBase}
          onPick={onPick}
        />
      ))}
    </>
  );
}

const INCUBATOR_PARTICLE_COUNT = 96;
const INCUBATOR_LONG_CYCLE = 120;
const FLOW_TINTS = {
  original: "#8dc5ff",
  parent: "#ffc27a",
  child: "#a9ffb5",
  sibling: "#dab9ff",
  ancestor: "#ffe29d",
};

function IncubatorMist({ fieldRef }) {
  const configs = useMemo(() => {
    const entries = [];
    for (let i = 0; i < INCUBATOR_PARTICLE_COUNT; i += 1) {
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
    configs.forEach((cfg, idx) => {
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
      instancedRef.current.setMatrixAt(idx, dummy.matrix);
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
    overlayMesh.scale.set(baseMesh.scale.x * scalePulse, baseMesh.scale.y * scalePulse, baseMesh.scale.z);

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

function IncubatorSceneContent({ imagesBase, data, onPick }) {
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
    .map((edge, idx) => {
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
          key={`inc-edge-${edge.source.name}-${edge.target.name}-${idx}`}
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
        entry.targetEntry.progressRef.current
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

const computePhylogenyLayout = (graph) => {
  if (!graph || !graph.nodes.length) {
    return { nodes: [], edges: [], bounds: null };
  }

  const levels = Array.from(
    new Set(
      graph.nodes.map((node) => (Number.isFinite(node.level) ? node.level : 0))
    )
  ).sort((a, b) => a - b);

  if (!levels.length) {
    return { nodes: [], edges: [], bounds: null };
  }

  const zeroIndex = levels.indexOf(0);
  const indexLookup = new Map(levels.map((level, idx) => [level, idx]));
  const nodesByLevel = new Map();

  graph.nodes.forEach((node) => {
    const level = Number.isFinite(node.level) ? node.level : 0;
    if (!nodesByLevel.has(level)) nodesByLevel.set(level, []);
    nodesByLevel.get(level).push(node);
  });

  nodesByLevel.forEach((list) => {
    list.sort((a, b) => a.name.localeCompare(b.name));
  });

  const tempEntries = [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  nodesByLevel.forEach((list, level) => {
    const levelIndex = indexLookup.get(level) ?? 0;
    const anchorIndex = zeroIndex >= 0 ? zeroIndex : 0;
    const y = (anchorIndex - levelIndex) * PHYLO_LEVEL_GAP;
    const count = list.length || 1;
    list.forEach((node, idx) => {
      const x = (idx - (count - 1) / 2) * PHYLO_NODE_SPACING;
      tempEntries.push({ node, x, y });
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    });
  });

  if (!tempEntries.length) {
    return { nodes: [], edges: [], bounds: null };
  }

  const offsetX = (minX + maxX) / 2 || 0;
  const offsetY = (minY + maxY) / 2 || 0;

  const placedNodes = [];
  const positionLookup = new Map();

  tempEntries.forEach(({ node, x, y }) => {
    const position = new THREE.Vector3(x - offsetX, y - offsetY, 0);
    const entry = { ...node, position };
    placedNodes.push(entry);
    positionLookup.set(node.name, entry);
  });

  const placedEdges = (graph.edges || [])
    .map((edge) => {
      const source = positionLookup.get(edge.source);
      const target = positionLookup.get(edge.target);
      if (!source || !target) return null;
      return { ...edge, source, target };
    })
    .filter(Boolean);

  const bounds = {
    minX: minX - offsetX,
    maxX: maxX - offsetX,
    minY: minY - offsetY,
    maxY: maxY - offsetY,
    width: maxX - minX,
    height: maxY - minY,
  };

  return { nodes: placedNodes, edges: placedEdges, bounds };
};

function PhylogenyNode({ node, imagesBase, onPick }) {
  const url = `${imagesBase}${node.name}`;
  const tex = useTexture(url);
  const sizeMultiplier = node.kind === "original" ? 1.2 : 1;
  const size = PHYLO_NODE_BASE_SIZE * sizeMultiplier;
  const frameSize = size * 1.1;
  const color = KIND_COLORS[node.kind] || "#d0d0d0";
  const frameRef = useRef();
  const imageRef = useRef();
  const [scales, setScales] = useState({
    frame: [frameSize, frameSize, 1],
    image: [size, size, 1],
  });

  useEffect(() => {
    if (!tex.image) return;
    const width = tex.image.width || 1;
    const height = tex.image.height || 1;
    const aspect = width / height || 1;
    const imageScale = [size, size / aspect, 1];
    const frameScale = [frameSize, frameSize / aspect, 1];
    setScales({ frame: frameScale, image: imageScale });
    if (frameRef.current) frameRef.current.scale.set(...frameScale);
    if (imageRef.current) imageRef.current.scale.set(...imageScale);
  }, [tex.image, size, frameSize]);

  return (
    <group position={node.position.toArray()}>
      <Billboard follow>
        <group>
          <mesh ref={frameRef} position={[0, 0, -0.02]} scale={scales.frame}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial color={color} transparent opacity={0.9} />
          </mesh>
          <mesh
            ref={imageRef}
            onClick={() => onPick?.(node.name)}
            onPointerOver={() => (document.body.style.cursor = "pointer")}
            onPointerOut={() => (document.body.style.cursor = "default")}
            scale={scales.image}
          >
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial map={tex} toneMapped={false} />
          </mesh>
        </group>
      </Billboard>
    </group>
  );
}

function PhylogenySceneContent({ imagesBase, data, onPick }) {
  const graph = useMemo(() => buildLineageGraph(data), [data]);
  const layout = useMemo(() => computePhylogenyLayout(graph), [graph]);

  if (!layout.nodes.length) {
    return null;
  }

  const paddingX = PHYLO_NODE_SPACING * 2.2;
  const paddingY = PHYLO_LEVEL_GAP * 1.8;
  const width = Math.max(layout.bounds?.width || 0, PHYLO_NODE_SPACING * 4) + paddingX;
  const height = Math.max(layout.bounds?.height || 0, PHYLO_LEVEL_GAP * 2) + paddingY;

  return (
    <group>
      <mesh position={[0, 0, -0.08]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color="#090909" transparent opacity={0.55} />
      </mesh>
      {layout.edges.map((edge) => (
        <Line
          key={`${edge.source.name}->${edge.target.name}`}
          points={[
            edge.source.position.toArray(),
            edge.target.position.toArray(),
          ]}
          color="#9aa0a6"
          lineWidth={2}
          depthTest={false}
          opacity={0.45}
          transparent
        />
      ))}
      {layout.nodes.map((node) => (
        <PhylogenyNode
          key={node.name}
          node={node}
          imagesBase={imagesBase}
          onPick={onPick}
        />
      ))}
    </group>
  );
}

function CameraTracker({ onCameraUpdate }) {
  const controls = useThree((state) => state.controls);
  const camera = useThree((state) => state.camera);
  const callbackRef = useRef(onCameraUpdate);
  const lastPayload = useRef(null);

  useEffect(() => {
    callbackRef.current = onCameraUpdate;
  }, [onCameraUpdate]);

  useEffect(() => {
    if (!controls || !camera) return;
    const emit = () => {
      const pos = camera.position;
      const target = controls.target;
      const payload = {
        position: { x: pos.x, y: pos.y, z: pos.z },
        target: { x: target.x, y: target.y, z: target.z },
      };
      const prev = lastPayload.current;
      const changed =
        !prev ||
        Math.abs(prev.position.x - payload.position.x) > 0.01 ||
        Math.abs(prev.position.y - payload.position.y) > 0.01 ||
        Math.abs(prev.position.z - payload.position.z) > 0.01 ||
        Math.abs(prev.target.x - payload.target.x) > 0.01 ||
        Math.abs(prev.target.y - payload.target.y) > 0.01 ||
        Math.abs(prev.target.z - payload.target.z) > 0.01;
      if (changed) {
        lastPayload.current = payload;
        callbackRef.current?.(payload);
      }
    };
    controls.addEventListener("change", emit);
    emit();
    return () => controls.removeEventListener("change", emit);
  }, [controls, camera]);

  return null;
}

function FpsTracker({ onFpsUpdate }) {
  const frameCount = useRef(0);
  const timeAccum = useRef(0);
  const lastReported = useRef(null);
  const callbackRef = useRef(onFpsUpdate);

  useEffect(() => {
    callbackRef.current = onFpsUpdate;
  }, [onFpsUpdate]);

  useFrame((_, delta) => {
    frameCount.current += 1;
    timeAccum.current += delta;
    if (timeAccum.current >= 0.5) {
      const fpsRaw = frameCount.current / timeAccum.current;
      frameCount.current = 0;
      timeAccum.current = 0;
      const rounded = Math.round(fpsRaw * 10) / 10;
      if (lastReported.current !== rounded) {
        lastReported.current = rounded;
        callbackRef.current?.(rounded);
      }
    }
  });

  return null;
}

function CameraPresetApplier({ preset }) {
  const controls = useThree((state) => state.controls);
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    if (!preset || !controls || !camera) return;
    const { position, target } = preset;
    if (position) {
      camera.position.set(position.x, position.y, position.z);
    }
    if (target) {
      controls.target.set(target.x, target.y, target.z);
    }
    controls.update();
  }, [preset, controls, camera]);

  return null;
}

export default function ThreeKinshipScene({
  imagesBase,
  clusters,
  data = null,
  phylogenyMode = false,
  incubatorMode = false,
  onPick,
  onFpsUpdate = () => {},
  onCameraUpdate = () => {},
  applyPreset = null,
}) {
  const cameraProps = phylogenyMode
    ? { fov: 50, position: [0, 0, 32] }
    : incubatorMode
    ? { fov: 52, position: [0, 2.4, 24] }
    : { fov: 55, position: [0, 1.2, 15] };

  const fogDensity = phylogenyMode ? 0.018 : incubatorMode ? 0.026 : 0.035;
  const ambientIntensity = phylogenyMode ? 1.1 : incubatorMode ? 1.05 : 0.9;
  const directionalIntensity = phylogenyMode ? 0.75 : incubatorMode ? 0.5 : 0.6;
  const minDistance = phylogenyMode ? 10 : incubatorMode ? 6 : 4;
  const maxDistance = phylogenyMode ? 80 : incubatorMode ? 48 : 60;

  return (
    <Canvas camera={cameraProps} gl={{ antialias: true }} style={{ width: "100%", height: "100%", background: "#000" }}>
      <fogExp2 attach="fog" args={[0x000000, fogDensity]} />
      <ambientLight intensity={ambientIntensity} />
      <directionalLight intensity={directionalIntensity} position={[5, 10, 7]} />
      {incubatorMode && <pointLight intensity={1.2} position={[0, 3, 0]} color="#3fa9ff" distance={42} decay={2} />}
      {phylogenyMode ? (
        <PhylogenySceneContent imagesBase={imagesBase} data={data} onPick={onPick} />
      ) : incubatorMode ? (
        <IncubatorSceneContent imagesBase={imagesBase} data={data} onPick={onPick} />
      ) : (
        <SceneContent imagesBase={imagesBase} clusters={clusters} onPick={onPick} />
      )}
      <OrbitControls
        enableDamping
        makeDefault
        minDistance={minDistance}
        maxDistance={maxDistance}
        enablePan
      />
      <FpsTracker onFpsUpdate={onFpsUpdate} />
      <CameraTracker onCameraUpdate={onCameraUpdate} />
      <CameraPresetApplier preset={applyPreset} />
    </Canvas>
  );
}
