import type { ClientQueueItem, ClientState } from "./client";
import type { IframeConfig, IframePanelConfig } from "./control";
import type { Scene, Script } from "./scene";
import type { EpisodeEntry, EpisodeTrack, IframeTimeline, SnapshotEntry, TimelineStep } from "./timeline";
import type { ScheduleDefinition, ScheduleEvent, ScheduleSummary } from "./schedule";

export type { SnapshotEntry, TimelineStep, IframeTimeline, EpisodeTrack, EpisodeEntry } from "./timeline";
export type { ClientQueueItem, ClientState } from "./client";
export type { Scene, Script } from "./scene";
export type { ScheduleDefinition, ScheduleEvent, ScheduleSummary } from "./schedule";

export interface ApiListResponse<T> {
  items?: T[];
  snapshots?: SnapshotEntry[];
  timelines?: IframeTimeline[];
  episodes?: EpisodeEntry[];
  [key: string]: unknown;
}

export interface SnapshotPanel extends IframePanelConfig {
  col_span?: number | undefined;
  row_span?: number | undefined;
}

export interface SnapshotConfig extends IframeConfig {
  panels: SnapshotPanel[];
}
