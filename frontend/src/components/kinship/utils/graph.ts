import { KIND_PRIORITY } from "./constants";
import type { KinshipClusterData, KinshipGraph, KinshipGraphEdge, KinshipGraphNode } from "../../../types/kinship";

const defaultGraph: KinshipGraph = { nodes: [], edges: [] };

export const sanitizeGraph = (graphInput: unknown, data: KinshipClusterData | null | undefined): KinshipGraph => {
  const graph = (graphInput || {}) as Partial<KinshipGraph>;
  const rawNodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const rawEdges = Array.isArray(graph.edges) ? graph.edges : [];

  const nodes: KinshipGraphNode[] = [];
  const nodeLookup = new Map<string, KinshipGraphNode>();

  rawNodes.forEach((node) => {
    if (!node || typeof node.name !== "string") return;
    const name = node.name;
    const level = Number.isFinite(node.level) ? (node.level as number) : 0;
    const kind = node.kind || (level === 0 ? "original" : level > 0 ? "child" : level === -1 ? "parent" : "ancestor");
    const normalized: KinshipGraphNode = { name, level, kind };
    nodes.push(normalized);
    nodeLookup.set(name, normalized);
  });

  if (!nodeLookup.has(data?.original_image || "")) {
    const fallbackOriginal: KinshipGraphNode = {
      name: data?.original_image || "unknown",
      level: 0,
      kind: "original",
    };
    nodes.push(fallbackOriginal);
    nodeLookup.set(fallbackOriginal.name, fallbackOriginal);
  }

  const edges: KinshipGraphEdge[] = [];
  const dedupe = new Set<string>();

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

export const buildFallbackGraph = (data: KinshipClusterData | null | undefined): KinshipGraph => {
  if (!data) return defaultGraph;
  const nodes: KinshipGraphNode[] = [];
  const edges: KinshipGraphEdge[] = [];
  const seen = new Map<string, KinshipGraphNode>();

  const upsert = (name: string | null | undefined, kind: string, level: number) => {
    if (!name) return;
    if (seen.has(name)) {
      const node = seen.get(name)!;
      if (level < (node.level || 0)) node.level = level;
      if (KIND_PRIORITY[kind] < KIND_PRIORITY[node.kind || "ancestor"]) node.kind = kind;
      return node;
    }
    const node: KinshipGraphNode = { name, kind, level };
    nodes.push(node);
    seen.set(name, node);
    return node;
  };

  const addEdge = (source: string | null | undefined, target: string | null | undefined) => {
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

  (data.ancestors_by_level || []).forEach((levelNames, index) => {
    const level = -(index + 1);
    (levelNames || []).forEach((name) => {
      upsert(name, index === 0 ? "parent" : "ancestor", level);
    });
    if (index > 0) {
      const prevLevel = data.ancestors_by_level?.[index - 1] || [];
      (levelNames || []).forEach((name) => {
        (prevLevel || []).forEach((prevName) => addEdge(name, prevName));
      });
    }
  });

  return { nodes, edges };
};

export const buildLineageGraph = (data: KinshipClusterData | null | undefined): KinshipGraph => {
  if (!data) return defaultGraph;
  const graph = sanitizeGraph(data.lineage_graph, data);
  if (graph.nodes.length > 0) return graph;
  return buildFallbackGraph(data);
};
