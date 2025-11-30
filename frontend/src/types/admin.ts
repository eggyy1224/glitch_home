export interface SnapshotEntry {
  name?: string;
  client?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface TimelineStep {
  snapshot?: string;
  duration?: number;
  label?: string;
  clientId?: string;
  client_id?: string;
  [key: string]: unknown;
}

export interface IframeTimeline {
  id: string;
  title?: string;
  clientId?: string;
  client_id?: string;
  steps?: TimelineStep[];
  [key: string]: unknown;
}

export interface EpisodeTrack {
  timelineId?: string;
  timeline_id?: string;
  targetClientId?: string;
  target_client_id?: string;
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

export interface ClientQueueItem {
  id: string;
  status?: string;
  eta?: number | string | null;
  priority?: number;
  payload?: unknown;
  position?: number;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface ClientState {
  id?: string;
  client_id?: string;
  status?: string;
  [key: string]: unknown;
}

export interface ApiListResponse<T> {
  items?: T[];
  snapshots?: SnapshotEntry[];
  timelines?: IframeTimeline[];
  episodes?: EpisodeEntry[];
  [key: string]: unknown;
}
