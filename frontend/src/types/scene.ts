export interface AudioMix {
  left?: number;
  right?: number;
  mode?: string;
  muted?: boolean;
  [key: string]: unknown;
}

export interface Scene {
  id: string;
  title?: string;
  targets?: Record<string, string>;
  audio_mix?: AudioMix;
  tags?: string[];
  description?: string;
  notes?: string;
  [key: string]: unknown;
}

export interface SceneEntrySummary {
  client_id?: string;
  snapshot?: string;
  [key: string]: unknown;
}

export interface ScriptEntry {
  type: "scene" | "snapshot_pair" | string;
  scene_id?: string;
  sceneId?: string;
  left_snapshot?: string;
  leftSnapshot?: string;
  right_snapshot?: string;
  rightSnapshot?: string;
  duration?: number;
  audio_override?: AudioMix;
  audioOverride?: AudioMix;
  notes?: string;
  [key: string]: unknown;
}

export interface Script {
  id: string;
  title?: string;
  entries?: ScriptEntry[];
  tags?: string[];
  description?: string;
  notes?: string;
  [key: string]: unknown;
}
