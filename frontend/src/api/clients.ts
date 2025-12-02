import { apiClient } from "./client";
import type { RequestOptions } from "../utils/request";
import type { ClientQueueItem, ClientState } from "../types/admin";

export async function fetchClientStates({ signal }: RequestOptions = {}): Promise<ClientState[]> {
  const data = await apiClient.get<{ clients?: ClientState[] }>(`/api/clients/state`, { signal });
  return Array.isArray(data.clients) ? data.clients : [];
}

export async function fetchClientQueue(
  clientId: string,
  {
    status = null,
    page = 1,
    limit = 50,
    signal,
  }: { status?: string | null; page?: number; limit?: number; signal?: AbortSignal } = {},
): Promise<{ items?: ClientQueueItem[]; total?: number }> {
  if (!clientId) throw new Error("clientId is required");
  const query: Record<string, string> = {
    client: clientId,
    page: String(page ?? 1),
    limit: String(limit ?? 50),
  };
  if (status) query.status = status;
  return apiClient.get(`/api/clients/queue`, { signal, query });
}

export async function enqueueClientQueueItem(
  payload: Record<string, unknown>,
  { signal }: RequestOptions = {},
): Promise<unknown> {
  return apiClient.post(`/api/clients/queue`, payload, { signal });
}

function queueActionPath(ids: string[] | string, action: string): string {
  const first = Array.isArray(ids) && ids.length > 0 ? ids[0] : "batch";
  return `/api/clients/queue/${encodeURIComponent(first)}/${action}`;
}

export async function cancelClientQueueItems(ids: string[] | string, { signal }: RequestOptions = {}): Promise<unknown> {
  const url = queueActionPath(ids, "cancel");
  return apiClient.post(url, { ids }, { signal });
}

export async function delayClientQueueItems(
  ids: string[] | string,
  { deltaSeconds = null, eta = null, signal }: { deltaSeconds?: number | null; eta?: string | number | null; signal?: AbortSignal } = {},
): Promise<unknown> {
  const url = queueActionPath(ids, "delay");
  const body: Record<string, unknown> = { ids };
  if (deltaSeconds !== null && deltaSeconds !== undefined) body.delta_seconds = deltaSeconds;
  if (eta !== null && eta !== undefined) body.eta = eta;
  return apiClient.post(url, body, { signal });
}

export async function moveClientQueueItems(
  ids: string[] | string,
  { priority = null, position = null, signal }: { priority?: number | null; position?: string | number | null; signal?: AbortSignal } = {},
): Promise<unknown> {
  const url = queueActionPath(ids, "move");
  const body: Record<string, unknown> = { ids };
  if (priority !== null && priority !== undefined) body.priority = priority;
  if (position) body.position = position;
  return apiClient.post(url, body, { signal });
}
