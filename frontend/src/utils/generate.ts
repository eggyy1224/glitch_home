export const IMAGES_BASE: string = import.meta.env.VITE_IMAGES_BASE || "/generated_images/";

export const ensureTrailingSlash = (value?: string | null): string => {
  if (!value) return "/";
  return value.endsWith("/") ? value : `${value}/`;
};

export const buildImageUrl = (base: string | null | undefined, identifier: string | null | undefined): string => {
  if (!identifier) return "";
  const normalizedIdentifier = identifier.replace(/^\/+/, "");
  if (!base) {
    return `/${normalizedIdentifier}`;
  }
  return `${ensureTrailingSlash(base)}${normalizedIdentifier}`;
};

export const extractImageIdentifier = (value?: unknown): string => {
  if (!value) return "";
  const sanitized = String(value).split("?")[0];
  const parts = sanitized.split("/");
  return parts[parts.length - 1] || "";
};

export interface ResolvableImage {
  filename?: string;
  url?: string;
}

export const resolveImageIdentifier = (image?: ResolvableImage | null): string => {
  if (!image) return "";
  return image.filename || extractImageIdentifier(image.url) || "";
};

export const resolveImageUrl = (image?: ResolvableImage | null, base: string = IMAGES_BASE): string => {
  const identifier = resolveImageIdentifier(image);
  if (!identifier) {
    return image?.url || "";
  }
  return buildImageUrl(base, identifier);
};
