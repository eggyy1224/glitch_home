import {
  COLLAGE_DEFAULT_COLS,
  COLLAGE_DEFAULT_IMAGE_COUNT,
  COLLAGE_DEFAULT_ROWS,
  COLLAGE_DEFAULT_STAGE_HEIGHT,
  COLLAGE_DEFAULT_STAGE_WIDTH,
  COLLAGE_MAX_COLS,
  COLLAGE_MAX_IMAGES,
  COLLAGE_MAX_ROWS,
  COLLAGE_STAGE_MAX_HEIGHT,
  COLLAGE_STAGE_MAX_WIDTH,
  COLLAGE_STAGE_MIN_HEIGHT,
  COLLAGE_STAGE_MIN_WIDTH,
} from "../constants/collage.js";

const clampInt = (value, min, max, fallback) => {
  const num = Number.parseInt(`${value}`, 10);
  if (Number.isNaN(num)) return fallback;
  if (num < min) return min;
  if (num > max) return max;
  return num;
};

const sanitizeImages = (value) => {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const result = [];
  value.forEach((item) => {
    if (typeof item !== "string") return;
    const trimmed = item.trim();
    if (!trimmed) return;
    if (trimmed.includes("/") || trimmed.includes("\\")) {
      return;
    }
    if (seen.has(trimmed)) return;
    seen.add(trimmed);
    result.push(trimmed);
  });
  return result;
};

export function sanitizeCollageConfig(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const images = sanitizeImages(payload.images);
  const imageCount = clampInt(
    payload.image_count ?? COLLAGE_DEFAULT_IMAGE_COUNT,
    1,
    COLLAGE_MAX_IMAGES,
    COLLAGE_DEFAULT_IMAGE_COUNT,
  );
  const rows = clampInt(payload.rows ?? COLLAGE_DEFAULT_ROWS, 1, COLLAGE_MAX_ROWS, COLLAGE_DEFAULT_ROWS);
  const cols = clampInt(payload.cols ?? COLLAGE_DEFAULT_COLS, 1, COLLAGE_MAX_COLS, COLLAGE_DEFAULT_COLS);
  const stageWidth = clampInt(
    payload.stage_width ?? COLLAGE_DEFAULT_STAGE_WIDTH,
    COLLAGE_STAGE_MIN_WIDTH,
    COLLAGE_STAGE_MAX_WIDTH,
    COLLAGE_DEFAULT_STAGE_WIDTH,
  );
  const stageHeight = clampInt(
    payload.stage_height ?? COLLAGE_DEFAULT_STAGE_HEIGHT,
    COLLAGE_STAGE_MIN_HEIGHT,
    COLLAGE_STAGE_MAX_HEIGHT,
    COLLAGE_DEFAULT_STAGE_HEIGHT,
  );

  let seed = null;
  if (payload.seed !== undefined && payload.seed !== null) {
    const num = Number.parseInt(`${payload.seed}`, 10);
    if (!Number.isNaN(num) && num >= 0) {
      seed = num;
    }
  }

  return {
    images,
    image_count: imageCount,
    rows,
    cols,
    mix: Boolean(payload.mix),
    stage_width: stageWidth,
    stage_height: stageHeight,
    seed,
  };
}

export function isRemoteCollageSource(source) {
  return source === "client" || source === "global";
}
