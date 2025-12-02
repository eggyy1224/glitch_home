import { apiClient } from "./client";
import type { RequestOptions } from "../utils/request";
import { API_BASE, buildImageUrl } from "../utils/request";

export interface CollageConfigPayload {
  images?: string[];
  image_count?: number;
  rows?: number;
  cols?: number;
  mix?: boolean;
  stage_width?: number;
  stage_height?: number;
  seed?: number | null;
  [key: string]: unknown;
}

interface CollageVersionResponse {
  output_image_path?: string;
  output_image?: string;
  imageUrl?: string | null;
  [key: string]: unknown;
}

export async function fetchCollageConfig(clientId: string | null = null, { signal }: RequestOptions = {}): Promise<unknown> {
  return apiClient.get(`/api/collage-config`, {
    signal,
    query: clientId ? { client: clientId } : undefined,
  });
}

export async function saveCollageConfig(config: CollageConfigPayload): Promise<unknown> {
  return apiClient.request(`/api/collage-config`, { method: "PUT", body: config });
}

export async function uploadScreenshot(
  blob: Blob,
  requestId: string | null = null,
  clientId: string | null = null,
): Promise<unknown> {
  const form = new FormData();
  const filename = `scene-${Date.now()}.png`;
  form.append("file", blob, filename);
  if (requestId) {
    form.append("request_id", requestId);
  }
  if (clientId) {
    form.append("client_id", clientId);
  }
  return apiClient.post(`/api/screenshots`, form);
}

export async function reportScreenshotFailure(requestId: string, errorMessage = "", clientId: string | null = null) {
  const payload: Record<string, unknown> = { error: errorMessage };
  if (clientId) {
    payload.client_id = clientId;
  }
  return apiClient.post(`/api/screenshots/${encodeURIComponent(requestId)}/fail`, payload);
}

export async function generateCollageVersion(files: File[], params: Record<string, unknown>): Promise<CollageVersionResponse> {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }
  formData.append("params", JSON.stringify(params));

  const result = (await apiClient.post<CollageVersionResponse>(`/api/generate-collage-version`, formData)) || {};
  const imageUrl = buildImageUrl(result.output_image ?? null, `${API_BASE}/generated_images/`);

  return {
    ...result,
    imageUrl,
  };
}

export async function generateCollageVersionFromNames(
  imageNames: string[],
  params: Record<string, unknown>,
): Promise<unknown> {
  return apiClient.post(`/api/generate-collage-version`, {
    image_names: imageNames,
    ...params,
  });
}

export async function getCollageProgress(taskId: string): Promise<unknown> {
  return apiClient.get(`/api/collage-version/${encodeURIComponent(taskId)}/progress`);
}

export async function listVideoAssets({ signal }: RequestOptions = {}): Promise<unknown> {
  return apiClient.get(`/api/video-assets`, { signal });
}
