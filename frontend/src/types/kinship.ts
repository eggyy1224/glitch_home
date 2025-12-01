import * as THREE from "three";

export interface KinshipVector3 {
  x: number;
  y: number;
  z: number;
}

export interface KinshipGraphNode {
  name: string;
  kind?: string;
  level?: number;
  [key: string]: unknown;
}

export interface KinshipGraphEdge {
  source: string;
  target: string;
}

export interface KinshipGraph {
  nodes: KinshipGraphNode[];
  edges: KinshipGraphEdge[];
}

export interface KinshipClusterData {
  original_image?: string;
  parents?: string[];
  siblings?: string[];
  children?: string[];
  ancestors_by_level?: string[][];
  ancestors?: string[];
  related_images?: string[];
  lineage_graph?: KinshipGraph | null;
}

export interface KinshipCluster {
  id: string | number;
  anchor: KinshipVector3;
  original?: string;
  data?: KinshipClusterData;
}

export interface KinshipData extends KinshipClusterData {
  lineage_graph?: KinshipGraph | null;
}

export interface KinshipCameraPose {
  position: KinshipVector3;
  target: KinshipVector3;
}

export interface KinshipCameraPreset {
  position?: KinshipVector3;
  target?: KinshipVector3;
}

export interface KinshipLayoutBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

export interface KinshipLayoutNode extends KinshipGraphNode {
  position?: THREE.Vector3;
}

export interface KinshipLayoutEdge {
  source: KinshipLayoutNode;
  target: KinshipLayoutNode;
}

export interface PhylogenyLayout {
  nodes: KinshipLayoutNode[];
  edges: KinshipLayoutEdge[];
  bounds: KinshipLayoutBounds | null;
}
