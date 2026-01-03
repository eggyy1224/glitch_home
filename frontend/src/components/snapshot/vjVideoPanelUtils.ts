import type { PanelConfig } from "./types";

export type VjVideoPanelOptions = {
  video?: string;
  vjBgm?: string | null;
  vjBgmVolume?: number | null;
  vjAutostartMic?: boolean;
  vjDebug?: boolean;
  vjVideoRateMin?: number | null;
  vjVideoRateMax?: number | null;
  vjVideoJumpMin?: number | null;
  vjVideoJumpMax?: number | null;
  vjVideoSwapThreshold?: number | null;
  vjVideoShuffle?: boolean | null;
};

const MODE_FLAG_KEYS = [
  "slide_mode",
  "vj_mode",
  "vj_video_mode",
  "video_mode",
  "static_mode",
  "incubator",
  "iframe_mode",
  "matrix_mode",
  "__preset_mode",
  "img",
  "top_k",
  "slide_source",
  "kinship_depth",
  "kinship_order",
  "include_deprecated",
  "video",
  "video_speed",
  "speed",
  "video_volume",
  "volume",
  "loop",
  "auto_unmute",
];

const getOrigin = () => (typeof window !== "undefined" ? window.location.origin : "http://localhost");

const toUrl = (rawUrl?: string | null) => {
  const origin = getOrigin();
  try {
    return new URL(rawUrl || "/?vj_video_mode=true", origin);
  } catch (err) {
    return new URL("/?vj_video_mode=true", origin);
  }
};

const parseNumber = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const clampNumber = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const parseBoolean = (value: string | boolean | number | null | undefined): boolean | undefined => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return undefined;
};

const setFloatParam = (params: URLSearchParams, key: string, value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    params.delete(key);
    return;
  }
  const rounded = Math.round(value * 1000) / 1000;
  params.set(key, String(rounded));
};

const setBooleanFlagParam = (params: URLSearchParams, key: string, value: boolean | null | undefined) => {
  if (!value) {
    params.delete(key);
    return;
  }
  params.set(key, "true");
};

const setBooleanValueParam = (params: URLSearchParams, key: string, value: boolean | null | undefined) => {
  if (value === null || value === undefined) {
    params.delete(key);
    return;
  }
  params.set(key, value ? "true" : "false");
};

export const parseVjVideoPanelOptions = (url?: string | null): VjVideoPanelOptions => {
  const parsed = toUrl(url);
  const params = parsed.searchParams;
  const video = params.get("vj_video") || params.get("video") || "";
  const vjBgm = params.get("vj_bgm") || null;
  const vjBgmVolume = parseNumber(params.get("vj_bgm_volume"));
  const vjAutostartMic = parseBoolean(params.get("vj_autostart_mic"));
  const vjDebug = parseBoolean(params.get("vj_debug"));
  const vjVideoRateMin = parseNumber(params.get("vj_video_rate_min"));
  const vjVideoRateMax = parseNumber(params.get("vj_video_rate_max"));
  const vjVideoJumpMin = parseNumber(params.get("vj_video_jump_min"));
  const vjVideoJumpMax = parseNumber(params.get("vj_video_jump_max"));
  const vjVideoSwapThreshold = parseNumber(params.get("vj_video_swap_threshold"));
  const vjVideoShuffle = parseBoolean(params.get("vj_video_shuffle"));

  return {
    video,
    vjBgm,
    vjBgmVolume: vjBgmVolume === undefined ? undefined : clampNumber(vjBgmVolume, 0, 1),
    vjAutostartMic: vjAutostartMic ?? false,
    vjDebug: vjDebug ?? false,
    vjVideoRateMin: vjVideoRateMin === undefined ? undefined : clampNumber(vjVideoRateMin, 0.1, 4),
    vjVideoRateMax: vjVideoRateMax === undefined ? undefined : clampNumber(vjVideoRateMax, 0.2, 6),
    vjVideoJumpMin: vjVideoJumpMin === undefined ? undefined : clampNumber(vjVideoJumpMin, 0.05, 10),
    vjVideoJumpMax: vjVideoJumpMax === undefined ? undefined : clampNumber(vjVideoJumpMax, 0.1, 20),
    vjVideoSwapThreshold: vjVideoSwapThreshold === undefined ? undefined : clampNumber(vjVideoSwapThreshold, 0, 1),
    vjVideoShuffle,
  };
};

export const buildVjVideoModeUrl = (panelUrl: PanelConfig["url"], updates: Partial<VjVideoPanelOptions>) => {
  const url = toUrl(panelUrl);
  const params = url.searchParams;

  MODE_FLAG_KEYS.forEach((key) => {
    params.delete(key);
  });
  params.set("vj_video_mode", "true");

  const current = parseVjVideoPanelOptions(panelUrl);
  const merged: VjVideoPanelOptions = { ...current, ...updates };

  if (merged.video) {
    params.set("video", merged.video);
    params.delete("vj_video");
  } else {
    params.delete("video");
    params.delete("vj_video");
  }

  if (merged.vjBgm) {
    params.set("vj_bgm", merged.vjBgm);
  } else {
    params.delete("vj_bgm");
  }
  setFloatParam(params, "vj_bgm_volume", merged.vjBgmVolume);
  setBooleanFlagParam(params, "vj_autostart_mic", merged.vjAutostartMic);
  setBooleanFlagParam(params, "vj_debug", merged.vjDebug);
  setFloatParam(params, "vj_video_rate_min", merged.vjVideoRateMin);
  setFloatParam(params, "vj_video_rate_max", merged.vjVideoRateMax);
  setFloatParam(params, "vj_video_jump_min", merged.vjVideoJumpMin);
  setFloatParam(params, "vj_video_jump_max", merged.vjVideoJumpMax);
  setFloatParam(params, "vj_video_swap_threshold", merged.vjVideoSwapThreshold);
  setBooleanValueParam(params, "vj_video_shuffle", merged.vjVideoShuffle);

  const qs = params.toString();
  return `${url.pathname}${qs ? `?${qs}` : ""}`;
};
