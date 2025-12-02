import { apiClient } from "./client";
import type { ResolveOption } from "./types";
import type { RequestOptions } from "../utils/request";
import type { Scene } from "../types/scene";

export async function fetchScene(
  sceneId: string,
  { signal, resolve = true, version }: ResolveOption = {},
): Promise<Scene> {
  if (!sceneId) throw new Error("sceneId is required");
  const query: Record<string, string> = {};
  if (resolve === false) query.resolve = "false";
  if (typeof version === "number") query.version = `${version}`;
  return apiClient.get(`/api/scenes/${encodeURIComponent(sceneId)}`, {
    signal,
    query: Object.keys(query).length ? query : undefined,
  });
}

export async function listScenes({ signal }: RequestOptions = {}): Promise<{ scenes?: Scene[] }> {
  return apiClient.get(`/api/scenes`, { signal });
}

export async function createScene(
  payload: Partial<Scene>,
  { resolve = true, signal, expectedVersion }: ResolveOption = {},
): Promise<Scene> {
  const query: Record<string, string> = {};
  if (resolve === false) query.resolve = "false";
  if (typeof expectedVersion === "number") query.expected_version = `${expectedVersion}`;
  return apiClient.post(`/api/scenes`, payload, {
    signal,
    query: Object.keys(query).length ? query : undefined,
  });
}

export async function updateScene(
  sceneId: string,
  payload: Partial<Scene>,
  { resolve = true, signal, expectedVersion }: ResolveOption = {},
): Promise<Scene> {
  if (!sceneId) throw new Error("sceneId is required");
  const query: Record<string, string> = {};
  if (resolve === false) query.resolve = "false";
  if (typeof expectedVersion === "number") query.expected_version = `${expectedVersion}`;
  return apiClient.put(`/api/scenes/${encodeURIComponent(sceneId)}`, payload, {
    signal,
    query: Object.keys(query).length ? query : undefined,
  });
}

export async function deleteScene(sceneId: string): Promise<unknown> {
  if (!sceneId) throw new Error("sceneId is required");
  return apiClient.del(`/api/scenes/${encodeURIComponent(sceneId)}`);
}

export async function cloneScene(
  sceneId: string,
  payload: Record<string, unknown>,
  { resolve = true, signal }: ResolveOption = {},
): Promise<Scene> {
  if (!sceneId) throw new Error("sceneId is required");
  const query: Record<string, string> = {};
  if (resolve === false) query.resolve = "false";
  return apiClient.post(`/api/scenes/${encodeURIComponent(sceneId)}/clone`, payload, {
    signal,
    query: Object.keys(query).length ? query : undefined,
  });
}

export async function playScene(
  sceneId: string,
  payload: Record<string, unknown> | null = null,
  { signal, allowDraft = false, version }: RequestOptions & { allowDraft?: boolean; version?: number } = {},
): Promise<unknown> {
  if (!sceneId) throw new Error("sceneId is required");
  const body = payload && typeof payload === "object" ? payload : {};
  const query: Record<string, string> = {};
  if (allowDraft) query.allow_draft = "true";
  if (typeof version === "number") query.version = `${version}`;
  return apiClient.post(`/api/scenes/${encodeURIComponent(sceneId)}/play`, body, {
    signal,
    query: Object.keys(query).length ? query : undefined,
  });
}

export async function listSceneVersions(sceneId: string, { signal }: RequestOptions = {}): Promise<{ versions?: unknown[] }> {
  if (!sceneId) throw new Error("sceneId is required");
  return apiClient.get(`/api/scenes/${encodeURIComponent(sceneId)}/versions`, { signal });
}

export async function publishScene(
  sceneId: string,
  payload: Record<string, unknown> | null = null,
  { signal, expectedVersion }: RequestOptions & { expectedVersion?: number } = {},
): Promise<Scene> {
  if (!sceneId) throw new Error("sceneId is required");
  const query: Record<string, string> = {};
  if (typeof expectedVersion === "number") query.expected_version = `${expectedVersion}`;
  return apiClient.post(`/api/scenes/${encodeURIComponent(sceneId)}/publish`, payload || {}, {
    signal,
    query: Object.keys(query).length ? query : undefined,
  });
}

export async function rollbackScene(
  sceneId: string,
  payload: Record<string, unknown>,
  { signal, expectedVersion }: RequestOptions & { expectedVersion?: number } = {},
): Promise<Scene> {
  if (!sceneId) throw new Error("sceneId is required");
  if (!payload || typeof (payload as { version?: unknown }).version === "undefined") {
    throw new Error("rollback payload requires version");
  }
  const query: Record<string, string> = {};
  if (typeof expectedVersion === "number") query.expected_version = `${expectedVersion}`;
  return apiClient.post(`/api/scenes/${encodeURIComponent(sceneId)}/rollback`, payload, {
    signal,
    query: Object.keys(query).length ? query : undefined,
  });
}
