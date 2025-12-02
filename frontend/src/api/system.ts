import { apiClient } from "./client";
import type { RequestOptions } from "../utils/request";

export interface CameraPreset {
  name: string;
  position: unknown;
  target: unknown;
  [key: string]: unknown;
}

export async function fetchKinship(img: string, depth = -1, { signal }: RequestOptions = {}): Promise<unknown> {
  const query = { img, depth };
  return apiClient.get(`/api/kinship`, { signal, query });
}

export async function fetchCameraPresets({ signal }: RequestOptions = {}): Promise<CameraPreset[]> {
  return apiClient.get(`/api/camera-presets`, { signal });
}

export async function saveCameraPreset(preset: Partial<CameraPreset>): Promise<CameraPreset> {
  return apiClient.post(`/api/camera-presets`, preset);
}

export async function deleteCameraPreset(name: string): Promise<boolean> {
  await apiClient.del(`/api/camera-presets/${encodeURIComponent(name)}`);
  return true;
}
