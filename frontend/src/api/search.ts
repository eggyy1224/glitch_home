import { apiClient } from "./client";
import type { RequestOptions } from "../utils/request";
import type { SearchRequestResult } from "../types/generate";

// 以圖搜圖 API
export async function searchImagesByImage(
  imagePath: string,
  topK = 10,
  { signal }: RequestOptions = {},
): Promise<SearchRequestResult> {
  const payload = { image_path: imagePath, top_k: topK };
  return apiClient.post(`/api/search/image`, payload, { signal });
}

// 文字搜尋 API
export async function searchImagesByText(
  query: string,
  topK = 10,
  { signal }: RequestOptions = {},
): Promise<SearchRequestResult> {
  const payload = { query, top_k: topK };
  return apiClient.post(`/api/search/text`, payload, { signal });
}

async function uploadImageForSearch(file: File | Blob, { signal }: RequestOptions = {}): Promise<{
  searchPath: string;
  fallbackPath: string;
}> {
  if (!file) {
    throw new Error("請先選擇圖片");
  }

  const formData = new FormData();
  formData.append("file", file);

  const data = await apiClient.post<{
    absolute_path?: string;
    relative_path?: string;
    original_filename?: string;
  }>(`/api/screenshots`, formData, { signal });

  const uploadedPath = data.absolute_path || data.relative_path;
  if (!uploadedPath) {
    throw new Error("上傳成功但無法取得檔案路徑");
  }

  const searchPath = data.original_filename ? `backend/offspring_images/${data.original_filename}` : uploadedPath;

  return {
    searchPath,
    fallbackPath: uploadedPath,
  };
}

export function createImageUploadRequest(file: File | Blob) {
  const controller = new AbortController();
  const promise = uploadImageForSearch(file, { signal: controller.signal });
  return { controller, promise };
}

export function createImageSearchRequest(imagePath: string, topK = 10): {
  controller: AbortController;
  promise: Promise<SearchRequestResult>;
} {
  const controller = new AbortController();
  const promise = searchImagesByImage(imagePath, topK, { signal: controller.signal });
  return { controller, promise };
}

export function createTextSearchRequest(query: string, topK = 10): {
  controller: AbortController;
  promise: Promise<SearchRequestResult>;
} {
  const controller = new AbortController();
  const promise = searchImagesByText(query, topK, { signal: controller.signal });
  return { controller, promise };
}
