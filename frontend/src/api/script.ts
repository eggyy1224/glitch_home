import { apiClient } from "./client";
import type { ResolveOption } from "./types";
import type { RequestOptions } from "../utils/request";
import type { Script } from "../types/scene";

export async function fetchScript(
  scriptId: string,
  { signal, resolve = true, version }: ResolveOption = {},
): Promise<Script> {
  if (!scriptId) throw new Error("scriptId is required");
  const query: Record<string, string> = {};
  if (resolve === false) query.resolve = "false";
  if (typeof version === "number") query.version = `${version}`;
  return apiClient.get(`/api/scripts/${encodeURIComponent(scriptId)}`, {
    signal,
    query: Object.keys(query).length ? query : undefined,
  });
}

export async function listScripts({ signal }: RequestOptions = {}): Promise<{ scripts?: Script[] }> {
  return apiClient.get(`/api/scripts`, { signal });
}

export async function createScript(
  payload: Partial<Script>,
  { resolve = true, signal, expectedVersion }: ResolveOption = {},
): Promise<Script> {
  const query: Record<string, string> = {};
  if (resolve === false) query.resolve = "false";
  if (typeof expectedVersion === "number") query.expected_version = `${expectedVersion}`;
  return apiClient.post(`/api/scripts`, payload, {
    signal,
    query: Object.keys(query).length ? query : undefined,
  });
}

export async function updateScript(
  scriptId: string,
  payload: Partial<Script>,
  { resolve = true, signal, expectedVersion }: ResolveOption = {},
): Promise<Script> {
  if (!scriptId) throw new Error("scriptId is required");
  const query: Record<string, string> = {};
  if (resolve === false) query.resolve = "false";
  if (typeof expectedVersion === "number") query.expected_version = `${expectedVersion}`;
  return apiClient.put(`/api/scripts/${encodeURIComponent(scriptId)}`, payload, {
    signal,
    query: Object.keys(query).length ? query : undefined,
  });
}

export async function deleteScript(scriptId: string): Promise<unknown> {
  if (!scriptId) throw new Error("scriptId is required");
  return apiClient.del(`/api/scripts/${encodeURIComponent(scriptId)}`);
}

export async function cloneScript(
  scriptId: string,
  payload: Record<string, unknown>,
  { resolve = true, signal }: ResolveOption = {},
): Promise<Script> {
  if (!scriptId) throw new Error("scriptId is required");
  const query: Record<string, string> = {};
  if (resolve === false) query.resolve = "false";
  return apiClient.post(`/api/scripts/${encodeURIComponent(scriptId)}/clone`, payload, {
    signal,
    query: Object.keys(query).length ? query : undefined,
  });
}

export async function playScript(
  scriptId: string,
  payload: Record<string, unknown> | null = null,
  { signal, allowDraft = false, version }: RequestOptions & { allowDraft?: boolean; version?: number } = {},
): Promise<unknown> {
  if (!scriptId) throw new Error("scriptId is required");
  const body = payload && typeof payload === "object" ? payload : {};
  const query: Record<string, string> = {};
  if (allowDraft) query.allow_draft = "true";
  if (typeof version === "number") query.version = `${version}`;
  return apiClient.post(`/api/scripts/${encodeURIComponent(scriptId)}/play`, body, {
    signal,
    query: Object.keys(query).length ? query : undefined,
  });
}

export async function listScriptVersions(scriptId: string, { signal }: RequestOptions = {}): Promise<{ versions?: unknown[] }> {
  if (!scriptId) throw new Error("scriptId is required");
  return apiClient.get(`/api/scripts/${encodeURIComponent(scriptId)}/versions`, { signal });
}

export async function publishScript(
  scriptId: string,
  payload: Record<string, unknown> | null = null,
  { signal, expectedVersion }: RequestOptions & { expectedVersion?: number } = {},
): Promise<Script> {
  if (!scriptId) throw new Error("scriptId is required");
  const query: Record<string, string> = {};
  if (typeof expectedVersion === "number") query.expected_version = `${expectedVersion}`;
  return apiClient.post(`/api/scripts/${encodeURIComponent(scriptId)}/publish`, payload || {}, {
    signal,
    query: Object.keys(query).length ? query : undefined,
  });
}

export async function rollbackScript(
  scriptId: string,
  payload: Record<string, unknown>,
  { signal, expectedVersion }: RequestOptions & { expectedVersion?: number } = {},
): Promise<Script> {
  if (!scriptId) throw new Error("scriptId is required");
  if (!payload || typeof (payload as { version?: unknown }).version === "undefined") {
    throw new Error("rollback payload requires version");
  }
  const query: Record<string, string> = {};
  if (typeof expectedVersion === "number") query.expected_version = `${expectedVersion}`;
  return apiClient.post(`/api/scripts/${encodeURIComponent(scriptId)}/rollback`, payload, {
    signal,
    query: Object.keys(query).length ? query : undefined,
  });
}

export async function stopScript(scriptId: string, { signal }: RequestOptions = {}): Promise<unknown> {
  if (!scriptId) throw new Error("scriptId is required");
  return apiClient.post(`/api/scripts/${encodeURIComponent(scriptId)}/stop`, undefined, { signal });
}
