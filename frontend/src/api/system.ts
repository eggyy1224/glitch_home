import { apiClient } from "./client";
import type { RequestOptions } from "../utils/request";

export interface CameraPreset {
  name: string;
  position: unknown;
  target: unknown;
  [key: string]: unknown;
}

export interface CameraPresetRequestOptions extends RequestOptions {
  scope?: string;
}

export async function fetchKinship(img: string, depth = -1, { signal }: RequestOptions = {}): Promise<unknown> {
  const query = { img, depth };
  return apiClient.get(`/api/kinship`, { signal, query });
}

export async function fetchCameraPresets({ signal, scope }: CameraPresetRequestOptions = {}): Promise<CameraPreset[]> {
  return apiClient.get(`/api/camera-presets`, { signal, query: scope ? { scope } : undefined });
}

export async function saveCameraPreset(
  preset: Partial<CameraPreset>,
  { scope }: CameraPresetRequestOptions = {},
): Promise<CameraPreset> {
  return apiClient.post(`/api/camera-presets`, preset, { query: scope ? { scope } : undefined });
}

export async function deleteCameraPreset(name: string, { scope }: CameraPresetRequestOptions = {}): Promise<boolean> {
  await apiClient.del(`/api/camera-presets/${encodeURIComponent(name)}`, { query: scope ? { scope } : undefined });
  return true;
}
