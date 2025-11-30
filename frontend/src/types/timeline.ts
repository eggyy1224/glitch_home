import type { ClientId } from "./client";

export interface SnapshotEntry {
  name?: string;
  client?: ClientId | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface RemoteClickAction {
  label?: string;
  selector?: string;
  target?: string;
  target_selector?: string;
  x?: number;
  y?: number;
  offset_seconds?: number;
  offsetSeconds?: number;
  target_client_id?: ClientId | null;
  targetClientId?: ClientId | null;
  [key: string]: unknown;
}

export interface VideoControlAction {
  action?: string;
  volume?: number;
  muted?: boolean;
  time?: number;
  offset_seconds?: number;
  offsetSeconds?: number;
  target_client_id?: ClientId | null;
  targetClientId?: ClientId | null;
  [key: string]: unknown;
}

export interface TimedTextActionBase {
  clear?: boolean;
  text?: string;
  language?: string;
  duration_seconds?: number;
  target_client_id?: ClientId | null;
  [key: string]: unknown;
}

export interface SubtitleAction extends TimedTextActionBase {}
export interface CaptionAction extends TimedTextActionBase {}

export type TtsMode = "sound_play" | "speak_with_subtitle" | "tts" | string;

export interface TtsAction {
  mode?: TtsMode;
  sound_filename?: string;
  text?: string;
  instructions?: string;
  voice?: string;
  model?: string;
  output_format?: string;
  filename_base?: string;
  speed?: number;
  auto_play?: boolean;
  target_client_id?: ClientId | null;
  subtitle_text?: string;
  subtitle_language?: string;
  subtitle_duration_seconds?: number;
  [key: string]: unknown;
}

export interface TimelineStep {
  snapshot?: string;
  duration?: number;
  label?: string;
  clientId?: ClientId;
  client_id?: ClientId;
  config?: Record<string, unknown>;
  subtitle?: SubtitleAction;
  caption?: CaptionAction;
  tts?: TtsAction;
  remote_clicks?: RemoteClickAction[];
  remoteClicks?: RemoteClickAction[];
  video_controls?: VideoControlAction[];
  videoControls?: VideoControlAction[];
  unlock_audio_targets?: Array<ClientId | string>;
  unlockAudioTargets?: Array<ClientId | string>;
  [key: string]: unknown;
}

export interface IframeTimeline {
  id: string;
  title?: string;
  clientId?: ClientId;
  client_id?: ClientId;
  steps?: TimelineStep[];
  loop?: boolean;
  [key: string]: unknown;
}

export interface EpisodeTrack {
  timelineId?: string;
  timeline_id?: string;
  targetClientId?: ClientId;
  target_client_id?: ClientId;
  priority?: number;
  [key: string]: unknown;
}

export interface EpisodeEntry {
  id: string;
  title?: string;
  tracks?: EpisodeTrack[];
  tags?: string[];
  [key: string]: unknown;
}

export interface TimelineControlOptions {
  startStep?: number;
  autoPlay?: boolean;
  loop?: boolean;
  releaseControl?: boolean;
  forceIframeMode?: boolean;
  commandId?: string;
  [key: string]: unknown;
}

export interface TimelineControlPayload {
  action?: string;
  timeline_id?: string;
  options?: TimelineControlOptions;
  target_client_id?: ClientId;
  command_id?: string;
  commandId?: string;
  [key: string]: unknown;
}

export interface SnapshotRef {
  client: ClientId | null;
  name: string;
}
