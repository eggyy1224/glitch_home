import type { AppMode, AppModeCapabilities, AppModeContextValue } from "./mode";
import type { IframeTimeline, TimelineControlPayload, TimelineStep } from "./timeline";

export type { AppMode, AppModeCapabilities, AppModeContextValue } from "./mode";

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
  [key: string]: unknown;
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

export type { TimelineControlPayload };
