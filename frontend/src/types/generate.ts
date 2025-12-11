export interface OffspringImage {
  filename: string;
  url?: string;
  relative_path?: string;
}

export interface SearchApiResult {
  id: string;
  name?: string;
  filename?: string;
  img?: string;
  distance?: number;
  [key: string]: unknown;
}

export interface GenerateMixTwoParams {
  parents?: string[];
  count?: number;
  prompt?: string;
  strength?: number;
  output_format?: string;
  output_width?: number;
  output_height?: number;
  output_max_side?: number;
  resize_mode?: string;
}

export interface GenerateMixTwoResponse {
  output_image?: string;
  output_image_path?: string;
  imageUrl?: string | null;
  width?: number;
  height?: number;
  output_format?: string;
  model_name?: string;
  parents?: string[];
}

export interface ListOffspringImagesResponse {
  images?: OffspringImage[];
}

export interface ListAncestorImagesResponse {
  images?: OffspringImage[];
}

export interface SearchRequestResult {
  results?: SearchApiResult[];
}
