export const IMAGES_BASE = import.meta.env.VITE_IMAGES_BASE || "/generated_images/";

export const ensureTrailingSlash = (value) => {
  if (!value) return "/";
  return value.endsWith("/") ? value : `${value}/`;
};

export const buildImageUrl = (base, identifier) => {
  if (!identifier) return "";
  const normalizedIdentifier = identifier.replace(/^\/+/, "");
  if (!base) {
    return `/${normalizedIdentifier}`;
  }
  return `${ensureTrailingSlash(base)}${normalizedIdentifier}`;
};

export const extractImageIdentifier = (value) => {
  if (!value) return "";
  const sanitized = String(value).split("?")[0];
  const parts = sanitized.split("/");
  return parts[parts.length - 1] || "";
};

export const resolveImageIdentifier = (image) => {
  if (!image) return "";
  return image.filename || extractImageIdentifier(image.url) || "";
};

export const resolveImageUrl = (image, base = IMAGES_BASE) => {
  const identifier = resolveImageIdentifier(image);
  if (!identifier) {
    return image?.url || "";
  }
  return buildImageUrl(base, identifier);
};
