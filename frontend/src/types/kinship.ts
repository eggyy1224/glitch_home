import * as THREE from "three";

export type KinshipNodeKind = "original" | "parent" | "child" | "sibling" | "ancestor";

export interface Vector3Like {
  x: number;
  y: number;
  z: number;
}

export interface KinshipLineageNode {
  name: string;
  level?: number;
  kind?: KinshipNodeKind | string;
}

export interface KinshipLineageEdge {
  source: string;
  target: string;
}

export interface KinshipLineageGraph {
  nodes?: KinshipLineageNode[];
  edges?: KinshipLineageEdge[];
}

export interface KinshipData {
  original_image?: string;
  parents?: string[];
  siblings?: string[];
  children?: string[];
  ancestors_by_level?: string[][];
  lineage_graph?: KinshipLineageGraph;
}

export interface KinshipCluster {
  id: string | number;
  anchor?: Vector3Like;
  data?: KinshipData;
  original?: string;
}

export interface CameraPreset {
  position?: Vector3Like;
  target?: Vector3Like;
}

export type KinshipOnPick = (name: string) => void;

export interface RingNode {
  name: string;
  pos: THREE.Vector3;
}

export interface IncubatorLayoutNode extends KinshipLineageNode {
  kind: KinshipNodeKind | string;
  angle: number;
  radius: number;
  baseY: number;
  orbitSpeed: number;
  floatAmp: number;
  floatSpeed: number;
  floatPhase: number;
  wobbleAmp: number;
  wobbleSpeed: number;
  growthDuration: number;
  spawnDelay: number;
}

export interface IncubatorEdge {
  source: IncubatorLayoutNode;
  target: IncubatorLayoutNode;
  baseOpacity: number;
}

export interface PhylogenyLayoutNode extends KinshipLineageNode {
  kind: KinshipNodeKind | string;
  position: THREE.Vector3;
}

export interface PhylogenyBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

export interface PhylogenyLayout {
  nodes: PhylogenyLayoutNode[];
  edges: { source: PhylogenyLayoutNode; target: PhylogenyLayoutNode }[];
  bounds: PhylogenyBounds | null;
}
