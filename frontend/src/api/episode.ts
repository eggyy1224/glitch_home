import { apiClient } from "./client";
import type { ResolveOption } from "./types";
import type { RequestOptions } from "../utils/request";
import type { EpisodeEntry } from "../types/admin";

export async function fetchEpisode(
  episodeId: string,
  { signal, resolve = true }: ResolveOption = {},
): Promise<EpisodeEntry> {
  if (!episodeId) {
    throw new Error("episodeId is required");
  }
  return apiClient.get(`/api/episodes/${encodeURIComponent(episodeId)}`, {
    signal,
    query: resolve === false ? { resolve: "false" } : undefined,
  });
}

export async function listEpisodes({ signal }: RequestOptions = {}): Promise<{ episodes?: EpisodeEntry[] }> {
  return apiClient.get(`/api/episodes`, { signal });
}

export async function createEpisode(
  payload: Partial<EpisodeEntry>,
  { resolve = true, signal }: ResolveOption = {},
): Promise<EpisodeEntry> {
  return apiClient.post<EpisodeEntry>(`/api/episodes`, payload, {
    signal,
    query: resolve === false ? { resolve: "false" } : undefined,
  });
}

export async function updateEpisode(
  episodeId: string,
  payload: Partial<EpisodeEntry>,
  { resolve = true, signal }: ResolveOption = {},
): Promise<EpisodeEntry> {
  if (!episodeId) throw new Error("episodeId is required");
  return apiClient.put<EpisodeEntry>(`/api/episodes/${encodeURIComponent(episodeId)}`, payload, {
    signal,
    query: resolve === false ? { resolve: "false" } : undefined,
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
  { signal }: RequestOptions = {},
): Promise<unknown> {
  if (!episodeId) throw new Error("episodeId is required");
  const body = payload && typeof payload === "object" ? payload : {};
  return apiClient.post(`/api/episodes/${encodeURIComponent(episodeId)}/play`, body, { signal });
}
