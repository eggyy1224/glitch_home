import { clamp } from "./collageMath.js";
import {
  COLLAGE_RATIO_MAX as RATIO_MAX,
  COLLAGE_RATIO_MIN as RATIO_MIN,
} from "../constants/collage.js";

const buildSearchParams = (search) => {
  if (search instanceof URLSearchParams) return search;
  if (typeof search === "string") return new URLSearchParams(search);
  if (typeof window !== "undefined" && window.location?.search) {
    return new URLSearchParams(window.location.search);
  }
  return new URLSearchParams();
};

export const readInitialParam = (key, fallback, min, max, search) => {
  const params = buildSearchParams(search);
  const raw = params.get(key);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return fallback;
  return clamp(parsed, min, max);
};

export const readInitialBooleanParam = (key, fallback, search) => {
  const params = buildSearchParams(search);
  const raw = params.get(key);
  if (!raw) return fallback;
  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

export const calculateDesiredRatio = (stageWidth, stageHeight) =>
  clamp(stageHeight / Math.max(stageWidth, 1), RATIO_MIN, RATIO_MAX);

export const defaultCollageStateUtils = {
  readInitialParam,
  readInitialBooleanParam,
  calculateDesiredRatio,
  nextSeed: () => Date.now(),
};
