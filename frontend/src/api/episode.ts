import { apiClient } from "./client";
import type { ResolveOption } from "./types";
import type { RequestOptions } from "../utils/request";
import type { EpisodeEntry } from "../types/admin";

export async function fetchEpisode(
  episodeId: string,
  { signal, resolve = true, version }: ResolveOption = {},
): Promise<EpisodeEntry> {
  if (!episodeId) {
    throw new Error("episodeId is required");
  }
  const query: Record<string, string> = {};
  if (resolve === false) query.resolve = "false";
  if (typeof version === "number") query.version = `${version}`;
  return apiClient.get(`/api/episodes/${encodeURIComponent(episodeId)}`, {
    signal,
    query: Object.keys(query).length ? query : undefined,
  });
}

export async function listEpisodes({ signal }: RequestOptions = {}): Promise<{ episodes?: EpisodeEntry[] }> {
  return apiClient.get(`/api/episodes`, { signal });
}

export async function createEpisode(
  payload: Partial<EpisodeEntry>,
  { resolve = true, signal, expectedVersion }: ResolveOption = {},
): Promise<EpisodeEntry> {
  const query: Record<string, string> = {};
  if (resolve === false) query.resolve = "false";
  if (typeof expectedVersion === "number") query.expected_version = `${expectedVersion}`;
  return apiClient.post<EpisodeEntry>(`/api/episodes`, payload, {
    signal,
    query: Object.keys(query).length ? query : undefined,
  });
}

export async function updateEpisode(
  episodeId: string,
  payload: Partial<EpisodeEntry>,
  { resolve = true, signal, expectedVersion }: ResolveOption = {},
): Promise<EpisodeEntry> {
  if (!episodeId) throw new Error("episodeId is required");
  const query: Record<string, string> = {};
  if (resolve === false) query.resolve = "false";
  if (typeof expectedVersion === "number") query.expected_version = `${expectedVersion}`;
  return apiClient.put<EpisodeEntry>(`/api/episodes/${encodeURIComponent(episodeId)}`, payload, {
    signal,
    query: Object.keys(query).length ? query : undefined,
  });
}

export async function deleteEpisode(episodeId: string): Promise<unknown> {
  if (!episodeId) throw new Error("episodeId is required");
  return apiClient.del(`/api/episodes/${encodeURIComponent(episodeId)}`);
}

export async function cloneEpisode(
  episodeId: string,
  payload: Record<string, unknown>,
  { resolve = true, signal }: ResolveOption = {},
): Promise<EpisodeEntry> {
  if (!episodeId) throw new Error("episodeId is required");
  if (!payload || typeof payload !== "object") throw new Error("payload is required");
  return apiClient.post<EpisodeEntry>(`/api/episodes/${encodeURIComponent(episodeId)}/clone`, payload, {
    signal,
    query: resolve === false ? { resolve: "false" } : undefined,
  });
}

export async function playEpisode(
  episodeId: string,
  payload: Record<string, unknown> = {},
  { signal, allowDraft = false, version }: RequestOptions & { allowDraft?: boolean; version?: number } = {},
): Promise<unknown> {
  if (!episodeId) throw new Error("episodeId is required");
  const body = payload && typeof payload === "object" ? payload : {};
  const query: Record<string, string> = {};
  if (allowDraft) query.allow_draft = "true";
  if (typeof version === "number") query.version = `${version}`;
  return apiClient.post(`/api/episodes/${encodeURIComponent(episodeId)}/play`, body, {
    signal,
    query: Object.keys(query).length ? query : undefined,
  });
}

export async function listEpisodeVersions(
  episodeId: string,
  { signal }: RequestOptions = {},
): Promise<{ versions?: unknown[] }> {
  if (!episodeId) throw new Error("episodeId is required");
  return apiClient.get(`/api/episodes/${encodeURIComponent(episodeId)}/versions`, { signal });
}

export async function publishEpisode(
  episodeId: string,
  payload: Record<string, unknown> | null = null,
  { signal, expectedVersion }: RequestOptions & { expectedVersion?: number } = {},
): Promise<EpisodeEntry> {
  if (!episodeId) throw new Error("episodeId is required");
  const query: Record<string, string> = {};
  if (typeof expectedVersion === "number") query.expected_version = `${expectedVersion}`;
  return apiClient.post(`/api/episodes/${encodeURIComponent(episodeId)}/publish`, payload || {}, {
    signal,
    query: Object.keys(query).length ? query : undefined,
  });
}

export async function rollbackEpisode(
  episodeId: string,
  payload: Record<string, unknown>,
  { signal, expectedVersion }: RequestOptions & { expectedVersion?: number } = {},
): Promise<EpisodeEntry> {
  if (!episodeId) throw new Error("episodeId is required");
  if (!payload || typeof (payload as { version?: unknown }).version === "undefined") {
    throw new Error("rollback payload requires version");
  }
  const query: Record<string, string> = {};
  if (typeof expectedVersion === "number") query.expected_version = `${expectedVersion}`;
  return apiClient.post(`/api/episodes/${encodeURIComponent(episodeId)}/rollback`, payload, {
    signal,
    query: Object.keys(query).length ? query : undefined,
  });
}
