export interface AudioMix {
  left?: number | undefined;
  right?: number | undefined;
  mode?: string | undefined;
  muted?: boolean | undefined;
  [key: string]: unknown;
}

export interface Scene {
  id: string;
  title?: string | undefined;
  targets?: Record<string, string> | undefined;
  audio_mix?: AudioMix | undefined;
  tags?: string[] | undefined;
  description?: string | undefined;
  notes?: string | undefined;
  [key: string]: unknown;
}

export interface SceneEntrySummary {
  client_id?: string | undefined;
  snapshot?: string | undefined;
  [key: string]: unknown;
}

export interface ScriptEntry {
  type: "scene" | "snapshot_pair" | string;
  scene_id?: string | undefined;
  sceneId?: string | undefined;
  left_snapshot?: string | undefined;
  leftSnapshot?: string | undefined;
  right_snapshot?: string | undefined;
  rightSnapshot?: string | undefined;
  duration?: number | undefined;
  audio_override?: AudioMix | undefined;
  audioOverride?: AudioMix | undefined;
  notes?: string | undefined;
  [key: string]: unknown;
}

export interface Script {
  id: string;
  title?: string | undefined;
  entries?: ScriptEntry[] | undefined;
  tags?: string[] | undefined;
  description?: string | undefined;
  notes?: string | undefined;
  [key: string]: unknown;
}
