import * as THREE from "three";

import {
  KIND_PRIORITY,
  MAX_INCUBATOR_NODES,
  INCUBATOR_LEVEL_GAP,
  INCUBATOR_BASE_RADIUS,
  INCUBATOR_RADIUS_STEP,
  PHYLO_LEVEL_GAP,
  PHYLO_NODE_SPACING,
} from "./constants.js";
import { seededRandom } from "./math.js";

export const createIncubatorLayout = (graph) => {
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

  const nodes = limited.map((node, index) => {
    const level = Number.isFinite(node.level) ? node.level : 0;
    const kind = node.kind || (level === 0 ? "sibling" : level > 0 ? "child" : "ancestor");
    const absLevel = Math.abs(level);
    const seedBase = `${node.name}:${index}`;
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

export const createIncubatorEdges = (graph, layoutNodes) => {
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

export const computePhylogenyLayout = (graph) => {
  if (!graph || !graph.nodes.length) {
    return { nodes: [], edges: [], bounds: null };
  }

  const levels = Array.from(
    new Set(graph.nodes.map((node) => (Number.isFinite(node.level) ? node.level : 0))),
  ).sort((a, b) => a - b);

  if (!levels.length) {
    return { nodes: [], edges: [], bounds: null };
  }

  const zeroIndex = levels.indexOf(0);
  const indexLookup = new Map(levels.map((level, index) => [level, index]));
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
    list.forEach((node, index) => {
      const x = (index - (count - 1) / 2) * PHYLO_NODE_SPACING;
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
