import type { ClientQueueItem, ClientState } from "./client";
import type { EpisodeEntry, EpisodeTrack, IframeTimeline, SnapshotEntry, TimelineStep } from "./timeline";

export type { SnapshotEntry, TimelineStep, IframeTimeline, EpisodeTrack, EpisodeEntry } from "./timeline";
export type { ClientQueueItem, ClientState } from "./client";

export interface ApiListResponse<T> {
  items?: T[];
  snapshots?: SnapshotEntry[];
  timelines?: IframeTimeline[];
  episodes?: EpisodeEntry[];
  [key: string]: unknown;
}
