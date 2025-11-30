export type ClientId = string;

export interface ClientQueueItem {
  id: string;
  client_id?: ClientId;
  type?: string;
  target_id?: string | null;
  target_client_id?: ClientId | null;
  status?: string;
  eta?: number | string | null;
  priority?: number;
  payload?: unknown;
  position?: number;
  retries?: number;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface ClientState {
  id?: string;
  client_id?: ClientId;
  status?: string;
  last_heartbeat?: string | null;
  current_item?: ClientQueueItem | null;
  last_completed_item?: ClientQueueItem | null;
  queue_size?: number;
  errors?: string[];
  [key: string]: unknown;
}
