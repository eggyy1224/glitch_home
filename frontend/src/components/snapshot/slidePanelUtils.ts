import type { PanelConfig } from "./types";

export type SlidePanelOptions = {
  img?: string;
  intervalMs?: number | null;
  imgBase?: string | null;
};

const MODE_FLAG_KEYS = [
  "video_mode",
  "static_mode",
  "incubator",
  "iframe_mode",
  "__preset_mode",
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
    return new URL(rawUrl || "/?slide_mode=true", origin);
  } catch (err) {
    return new URL("/?slide_mode=true", origin);
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

const ensureTrailingSlash = (value?: string | null): string | null => {
  if (!value) return null;
  return value.endsWith("/") ? value : `${value}/`;
};

const setNumberParam = (params: URLSearchParams, key: string, value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    params.delete(key);
    return;
  }
  const safeValue = Math.max(0, Math.floor(value));
  params.set(key, String(safeValue));
};

export const parseSlidePanelOptions = (
  url?: string | null,
  panelParams?: PanelConfig["params"],
): SlidePanelOptions => {
  const parsed = toUrl(url);
  const params = parsed.searchParams;
  const img = params.get("img") || "";
  const intervalFromUrl = parseNumber(params.get("slide_interval") ?? params.get("slide_interval_ms"));
  const paramEntries = (panelParams && typeof panelParams === "object" ? panelParams : {}) as Record<string, unknown>;
  const intervalFromParams =
    parseNumber(paramEntries.slide_interval as string) ?? parseNumber(paramEntries.slide_interval_ms as string);
  const imgBase = params.get("img_base");

  return {
    img,
    intervalMs: intervalFromUrl ?? intervalFromParams,
    imgBase,
  };
};

export const buildSlideModeUrl = (
  panelUrl: PanelConfig["url"],
  updates: Partial<SlidePanelOptions>,
  options?: { imgBase?: string | null; panelParams?: PanelConfig["params"] },
) => {
  const url = toUrl(panelUrl);
  const params = url.searchParams;

  MODE_FLAG_KEYS.forEach((key) => params.delete(key));
  params.set("slide_mode", "true");

  const current = parseSlidePanelOptions(panelUrl, options?.panelParams);
  const merged: SlidePanelOptions = { ...current, ...updates };

  const mergedImgBase = options?.imgBase !== undefined ? options.imgBase : merged.imgBase;
  if (mergedImgBase !== undefined) {
    const normalized = ensureTrailingSlash(mergedImgBase);
    if (normalized) {
      params.set("img_base", normalized);
    } else {
      params.delete("img_base");
    }
  }

  if (merged.img) {
    params.set("img", merged.img);
  } else {
    params.delete("img");
  }

  setNumberParam(params, "slide_interval", merged.intervalMs);
  setNumberParam(params, "slide_interval_ms", merged.intervalMs);

  const qs = params.toString();
  return `${url.pathname}${qs ? `?${qs}` : ""}`;
};
