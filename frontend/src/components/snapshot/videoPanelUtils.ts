import type { PanelConfig } from "./types";

export type VideoPanelOptions = {
  video?: string;
  volume?: number | null;
  speed?: number | null;
  autoUnmute?: boolean | null;
  loop?: boolean | null;
};

const getOrigin = () => (typeof window !== "undefined" ? window.location.origin : "http://localhost");

const toUrl = (rawUrl?: string | null) => {
  const origin = getOrigin();
  try {
    return new URL(rawUrl || "/?video_mode=true", origin);
  } catch (err) {
    return new URL("/?video_mode=true", origin);
  }
};

const MODE_FLAG_KEYS = ["slide_mode", "static_mode", "incubator", "iframe_mode", "matrix_mode", "__preset_mode", "img"];

const parseNumber = (value: string | null | undefined) => {
  if (value == null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseBoolean = (value: string | null | undefined): boolean | undefined => {
  if (value == null || value === "") return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (["true", "1", "yes"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;
  return undefined;
};

export const parseVideoPanelOptions = (url?: string | null): VideoPanelOptions => {
  const parsed = toUrl(url);
  const params = parsed.searchParams;
  const video = params.get("video") || "";
  const volume = parseNumber(params.get("video_volume")) ?? parseNumber(params.get("volume"));
  const speed = parseNumber(params.get("video_speed")) ?? parseNumber(params.get("speed"));
  const autoUnmute = parseBoolean(params.get("auto_unmute"));
  const loop = parseBoolean(params.get("loop"));
  return { video, volume, speed, autoUnmute, loop };
};

const setNumberParam = (params: URLSearchParams, key: string, value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) {
    params.delete(key);
    return;
  }
  params.set(key, String(value));
};

const setBooleanParam = (params: URLSearchParams, key: string, value: boolean | null | undefined) => {
  if (value == null) {
    params.delete(key);
    return;
  }
  params.set(key, value ? "true" : "false");
};

export const buildVideoModeUrl = (panelUrl: PanelConfig["url"], updates: Partial<VideoPanelOptions>) => {
  const url = toUrl(panelUrl);
  const params = url.searchParams;

  MODE_FLAG_KEYS.forEach((key) => {
    params.delete(key);
  });
  params.set("video_mode", "true");

  const current = parseVideoPanelOptions(panelUrl);
  const merged: VideoPanelOptions = { ...current, ...updates };

  if (merged.video) {
    params.set("video", merged.video);
  } else {
    params.delete("video");
  }

  setNumberParam(params, "video_volume", merged.volume);
  setNumberParam(params, "volume", merged.volume);
  setNumberParam(params, "video_speed", merged.speed);
  setNumberParam(params, "speed", merged.speed);
  setBooleanParam(params, "auto_unmute", merged.autoUnmute);
  setBooleanParam(params, "loop", merged.loop);

  const qs = params.toString();
  return `${url.pathname}${qs ? `?${qs}` : ""}`;
};
