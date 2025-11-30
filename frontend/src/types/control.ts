import type { IframeTimeline, TimelineStep } from "./admin";

export interface AppModeCapabilities {
  canGenerate: boolean;
  canWriteMetadata: boolean;
  canWriteAssets: boolean;
  canAnalyze: boolean;
  canRebuildIndex: boolean;
}

export interface AppModeContextValue {
  appMode: string;
  capabilities: AppModeCapabilities;
  loading: boolean;
  error: string | null;
  refresh: () => void | Promise<void>;
  forbidMessage: string;
}

export interface CameraVector {
  x: number;
  y: number;
  z: number;
}

export interface CameraInfo {
  position: CameraVector;
  target: CameraVector;
}

export interface CameraPreset extends Record<string, unknown> {
  name: string;
  position: CameraVector;
  target: CameraVector;
  key?: number;
}

export interface SubtitleCaptionState {
  subtitle: string | null;
  caption: string | null;
}

export interface ScreenshotLifecyclePayload {
  request_id?: string;
  [key: string]: unknown;
}

export interface SubtitlePayload {
  subtitle?: string | null;
  target_client_id?: string | null;
  [key: string]: unknown;
}

export interface CaptionPayload {
  caption?: string | null;
  target_client_id?: string | null;
  [key: string]: unknown;
}

export interface IframePanelConfig {
  id: string;
  src?: string;
  ratio?: number;
  label?: string;
  image?: string;
  params?: Record<string, unknown>;
  url?: string;
  colSpan?: number;
  rowSpan?: number;
  col_span?: number;
  row_span?: number;
}

export interface IframeConfig {
  id?: string;
  layout: string;
  gap: number;
  columns: number;
  panels: IframePanelConfig[];
}

export interface TimelineStepWithConfig extends TimelineStep {
  config?: IframeConfig;
}

export interface IframeTimelineResolved extends IframeTimeline {
  steps?: TimelineStepWithConfig[];
}

export interface VideoController {
  play?: () => void;
  pause?: () => void;
  seek?: (time: number) => void;
  setVolume?: (volume?: number) => void;
  setMuted?: (muted?: boolean) => void;
}

export interface TimelineControlPayload {
  action?: string;
  timeline_id?: string;
  options?: Record<string, unknown>;
  target_client_id?: string;
  command_id?: string;
  commandId?: string;
  [key: string]: unknown;
}
