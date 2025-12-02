import { apiClient } from "./client";
import { IMAGES_BASE } from "../utils/request";
import type { RequestOptions } from "../utils/request";
import type { GenerateMixTwoParams, GenerateMixTwoResponse, ListOffspringImagesResponse } from "../types/generate";

export async function listOffspringImages({ signal }: RequestOptions = {}): Promise<ListOffspringImagesResponse> {
  return apiClient.get(`/api/offspring-images`, { signal });
}

export async function generateMixTwo(params: GenerateMixTwoParams): Promise<GenerateMixTwoResponse> {
  const result = (await apiClient.post(`/api/generate/mix-two`, params)) as GenerateMixTwoResponse;
  const imageFilename = result.output_image_path?.split("/").pop() || result.output_image;
  const normalizedBase = IMAGES_BASE.endsWith("/") ? IMAGES_BASE : `${IMAGES_BASE}/`;
  const imageUrl = imageFilename ? `${normalizedBase}${imageFilename}` : null;
  return {
    ...result,
    imageUrl,
  };
}
