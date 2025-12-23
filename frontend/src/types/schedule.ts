export type ScheduleEventType = "snapshot" | "timeline" | "episode" | "scene" | "script";

export interface ScheduleEvent {
  id?: string;
  time: string;
  type: ScheduleEventType;
  target_id: string;
  client_id?: string | null;
  payload?: Record<string, unknown> | null;
  enabled?: boolean;
  notes?: string | null;
}

export interface ScheduleDefinition {
  id: string;
  title?: string;
  timezone?: string;
  status?: "active" | "paused";
  repeat?: "daily";
  events: ScheduleEvent[];
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ScheduleSummary {
  id: string;
  title?: string;
  status?: string;
  timezone?: string;
  repeat?: string;
  event_count?: number;
  updated_at?: string | null;
}

export interface ScheduleDeployItem {
  schedule_id: string;
  event_id: string;
  client_id: string;
  type: ScheduleEventType;
  target_id: string;
  eta: string;
  occurs_at: string;
  schedule_key: string;
}

export interface ScheduleDeployResult {
  schedule_id: string;
  dry_run: boolean;
  planned?: ScheduleDeployItem[];
  created?: Array<{ event_id: string; queue_item: Record<string, unknown> }>;
  skipped?: Array<{ event_id: string; reason: string }>;
}
