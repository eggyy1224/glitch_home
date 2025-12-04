import { apiClient } from "./client";
import type { ResolveOption } from "./types";
import type { RequestOptions } from "../utils/request";
import type { IframeTimeline, SnapshotEntry } from "../types/admin";

export async function fetchIframeTimeline(
  timelineId: string,
  { signal, resolve = true, version }: ResolveOption = {},
): Promise<IframeTimeline> {
  if (!timelineId) {
    throw new Error("timelineId is required");
  }
  const query: Record<string, string> = {};
  if (resolve === false) query.resolve = "false";
  if (typeof version === "number") query.version = `${version}`;
  return apiClient.get(`/api/iframe-timelines/${encodeURIComponent(timelineId)}`, {
    signal,
    query: Object.keys(query).length ? query : undefined,
  });
}

export async function listIframeTimelines(
  clientId: string | null = null,
  { signal }: RequestOptions = {},
): Promise<{ timelines?: IframeTimeline[] }> {
  return apiClient.get(`/api/iframe-timelines`, {
    signal,
    query: clientId ? { client: clientId } : undefined,
  });
}

export async function createIframeTimeline(
  payload: Partial<IframeTimeline>,
  { resolve = true, signal, expectedVersion }: ResolveOption = {},
): Promise<IframeTimeline> {
  const query: Record<string, string> = {};
  if (resolve === false) query.resolve = "false";
  if (typeof expectedVersion === "number") query.expected_version = `${expectedVersion}`;
  return apiClient.post(`/api/iframe-timelines`, payload, {
    signal,
    query: Object.keys(query).length ? query : undefined,
  });
}

export async function updateIframeTimeline(
  timelineId: string,
  payload: Partial<IframeTimeline>,
  { resolve = true, signal, expectedVersion }: ResolveOption = {},
): Promise<IframeTimeline> {
  return apiClient.put(`/api/iframe-timelines/${encodeURIComponent(timelineId)}`, payload, {
    signal,
    query:
      resolve === false || typeof expectedVersion === "number"
        ? {
            ...(resolve === false ? { resolve: "false" } : {}),
            ...(typeof expectedVersion === "number" ? { expected_version: `${expectedVersion}` } : {}),
          }
        : undefined,
  });
}

export async function deleteIframeTimeline(timelineId: string, { signal }: RequestOptions = {}): Promise<unknown> {
  return apiClient.del(`/api/iframe-timelines/${encodeURIComponent(timelineId)}`, { signal });
}

export async function cloneIframeTimeline(
  timelineId: string,
  payload: Record<string, unknown>,
  { resolve = true, signal }: ResolveOption = {},
): Promise<IframeTimeline> {
  return apiClient.post(`/api/iframe-timelines/${encodeURIComponent(timelineId)}/clone`, payload, {
    signal,
    query: resolve === false ? { resolve: "false" } : undefined,
  });
}

export async function playIframeTimeline(
  timelineId: string,
  payload: Record<string, unknown> = {},
  {
    targetClientId = null,
    signal,
    allowDraft = false,
    version,
  }: { targetClientId?: string | null; signal?: AbortSignal; allowDraft?: boolean; version?: number } = {},
): Promise<unknown> {
  if (!timelineId) {
    throw new Error("timelineId is required");
  }
  const query: Record<string, string> = {};
  if (targetClientId) query.target_client_id = targetClientId;
  if (allowDraft) query.allow_draft = "true";
  if (typeof version === "number") query.version = `${version}`;
  return apiClient.post(`/api/iframe-timelines/${encodeURIComponent(timelineId)}/play`, payload || {}, {
    signal,
    query: Object.keys(query).length ? query : undefined,
  });
}

export async function listIframeTimelineVersions(
  timelineId: string,
  { signal }: RequestOptions = {},
): Promise<{ versions?: unknown[] }> {
  if (!timelineId) throw new Error("timelineId is required");
  return apiClient.get(`/api/iframe-timelines/${encodeURIComponent(timelineId)}/versions`, { signal });
}

export async function publishIframeTimeline(
  timelineId: string,
  payload: Record<string, unknown> | null = null,
  { signal, expectedVersion }: RequestOptions & { expectedVersion?: number } = {},
): Promise<IframeTimeline> {
  if (!timelineId) throw new Error("timelineId is required");
  const query: Record<string, string> = {};
  if (typeof expectedVersion === "number") query.expected_version = `${expectedVersion}`;
  return apiClient.post(`/api/iframe-timelines/${encodeURIComponent(timelineId)}/publish`, payload || {}, {
    signal,
    query: Object.keys(query).length ? query : undefined,
  });
}

export async function rollbackIframeTimeline(
  timelineId: string,
  payload: Record<string, unknown>,
  { signal, expectedVersion }: RequestOptions & { expectedVersion?: number } = {},
): Promise<IframeTimeline> {
  if (!timelineId) throw new Error("timelineId is required");
  if (!payload || typeof (payload as { version?: unknown }).version === "undefined") {
    throw new Error("rollback payload requires version");
  }
  const query: Record<string, string> = {};
  if (typeof expectedVersion === "number") query.expected_version = `${expectedVersion}`;
  return apiClient.post(`/api/iframe-timelines/${encodeURIComponent(timelineId)}/rollback`, payload, {
    signal,
    query: Object.keys(query).length ? query : undefined,
  });
}

export async function stopIframeTimeline(
  targetClientId: string | null,
  timelineId: string | null = null,
  options: { commandId?: string; releaseControl?: boolean } = {},
): Promise<unknown> {
  const body: Record<string, unknown> = {
    target_client_id: targetClientId || null,
    timeline_id: timelineId || null,
    command_id: options.commandId,
    release_control: options.releaseControl !== undefined ? options.releaseControl : true,
  };
  return apiClient.post(`/api/iframe-timelines/stop`, body);
}

export async function listIframeSnapshots(
  clientId: string | null = null,
  { signal }: RequestOptions = {},
): Promise<{ snapshots?: SnapshotEntry[] }> {
  return apiClient.get(`/api/iframe-config/snapshots`, {
    signal,
    query: clientId ? { client: clientId } : undefined,
  });
}

export async function getIframeSnapshot(
  clientId: string | null,
  name: string,
  { signal }: RequestOptions = {},
): Promise<unknown> {
  if (!clientId) {
    throw new Error("clientId is required");
  }
  return apiClient.get(`/api/iframe-config/snapshots/${encodeURIComponent(clientId)}/${encodeURIComponent(name)}`, {
    signal,
  });
}

export async function saveIframeSnapshot(
  clientId: string | null,
  name: string,
  payload: unknown,
  { signal }: RequestOptions = {},
): Promise<unknown> {
  if (!clientId) {
    throw new Error("clientId is required");
  }
  return apiClient.put(`/api/iframe-config/snapshots/${encodeURIComponent(clientId)}/${encodeURIComponent(name)}`, payload, {
    signal,
  });
}

export async function deleteIframeSnapshot(
  clientId: string | null,
  name: string,
  { signal }: RequestOptions = {},
): Promise<unknown> {
  if (!clientId) {
    throw new Error("clientId is required");
  }
  return apiClient.del(`/api/iframe-config/snapshots/${encodeURIComponent(clientId)}/${encodeURIComponent(name)}`, { signal });
}

export async function cloneIframeSnapshot(
  clientId: string | null,
  name: string,
  payload: Record<string, unknown>,
  { signal }: RequestOptions = {},
): Promise<unknown> {
  if (!clientId) {
    throw new Error("clientId is required");
  }
  return apiClient.post(
    `/api/iframe-config/snapshots/${encodeURIComponent(clientId)}/${encodeURIComponent(name)}/clone`,
    payload,
    { signal },
  );
}

export async function restoreIframeSnapshot(
  clientId: string | null,
  snapshotName: string,
  { signal }: RequestOptions = {},
): Promise<unknown> {
  if (!snapshotName) {
    throw new Error("snapshotName is required");
  }
  const body: Record<string, unknown> = { snapshot_name: snapshotName };
  if (clientId) {
    body.client_id = clientId;
  }
  return apiClient.post(`/api/iframe-config/restore`, body, { signal });
}

export async function sendRemoteClick(payload: Record<string, unknown>, options: RequestOptions = {}): Promise<unknown> {
  if (!payload || typeof payload !== "object") {
    throw new Error("remote click payload is required");
  }
  return apiClient.post(`/api/remote-click`, payload, options);
}

export async function sendVideoControl(payload: Record<string, unknown>, options: RequestOptions = {}): Promise<unknown> {
  if (!payload || typeof payload !== "object") {
    throw new Error("video control payload is required");
  }
  return apiClient.post(`/api/video-control`, payload, options);
}
