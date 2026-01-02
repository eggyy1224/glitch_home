import {
  DEFAULT_KINSHIP_DEPTH,
  DEFAULT_KINSHIP_ORDER,
  DEFAULT_SLIDE_TOP_K,
  SlideSourceMode,
  type KinshipRelation,
} from "../../utils/slideMode";
import type { PanelConfig } from "./types";

export type { KinshipRelation };

export type SlidePanelOptions = {
  img?: string;
  intervalMs?: number | null;
  imgBase?: string | null;
  topK?: number;
  slideSource?: (typeof SlideSourceMode)[keyof typeof SlideSourceMode];
  kinshipDepth?: number | null;
  kinshipOrder?: KinshipRelation[];
  includeDeprecated?: boolean;
};

const MODE_FLAG_KEYS = [
  "slide_mode",
  "vj_mode",
  "video_mode",
  "static_mode",
  "incubator",
  "iframe_mode",
  "matrix_mode",
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

const setNumberParam = (
  params: URLSearchParams,
  key: string,
  value: number | null | undefined,
  options?: { min?: number },
) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    params.delete(key);
    return;
  }
  const min = options?.min ?? 0;
  const safeValue = Math.max(min, Math.floor(value));
  params.set(key, String(safeValue));
};

const setNumberLike = (params: Record<string, unknown>, key: string, value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    delete params[key];
    return;
  }
  const safeValue = Math.floor(value);
  params[key] = String(safeValue);
};

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

const parseKinshipOrder = (value: string | string[] | undefined): KinshipRelation[] => {
  const raw = Array.isArray(value) ? value.join(",") : value;
  if (!raw) return DEFAULT_KINSHIP_ORDER;
  const parts = raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean) as KinshipRelation[];
  const seen: Set<KinshipRelation> = new Set();
  const ordered: KinshipRelation[] = [];
  parts.forEach((item) => {
    if (DEFAULT_KINSHIP_ORDER.includes(item) && !seen.has(item)) {
      seen.add(item);
      ordered.push(item);
    }
  });
  if (!ordered.length) return DEFAULT_KINSHIP_ORDER;
  return ordered;
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
  const topKFromUrl = parseNumber(params.get("top_k"));
  const topKFromParams = parseNumber(paramEntries.top_k as string);
  const rawSlideSource = (params.get("slide_source") ?? paramEntries.slide_source) as string | undefined;
  const slideSource = rawSlideSource?.toLowerCase() === SlideSourceMode.KINSHIP ? SlideSourceMode.KINSHIP : SlideSourceMode.VECTOR;
  const kinshipDepthFromUrl = parseNumber(params.get("kinship_depth"));
  const kinshipDepthFromParams = parseNumber(paramEntries.kinship_depth as string);
  const kinshipOrderRaw = (params.get("kinship_order") ?? paramEntries.kinship_order) as string | undefined;
  const includeDeprecatedRaw = (params.get("include_deprecated") ??
    (paramEntries.include_deprecated as string | boolean | number | null | undefined)) as string | boolean | number | null | undefined;
  const resolvedTopK = topKFromUrl ?? topKFromParams ?? DEFAULT_SLIDE_TOP_K;
  const safeTopK = Number.isFinite(resolvedTopK) ? Math.max(1, Math.floor(resolvedTopK)) : DEFAULT_SLIDE_TOP_K;
  const resolvedDepth = kinshipDepthFromUrl ?? kinshipDepthFromParams;
  const safeDepth =
    resolvedDepth === undefined || resolvedDepth === null || Number.isNaN(resolvedDepth)
      ? undefined
      : Math.floor(resolvedDepth);

  return {
    img,
    intervalMs: intervalFromUrl ?? intervalFromParams,
    imgBase,
    topK: safeTopK,
    slideSource,
    kinshipDepth: safeDepth ?? DEFAULT_KINSHIP_DEPTH,
    kinshipOrder: parseKinshipOrder(kinshipOrderRaw),
    includeDeprecated: parseBoolean(includeDeprecatedRaw) ?? false,
  };
};

export const buildSlideModeUrl = (
  panelUrl: PanelConfig["url"],
  updates: Partial<SlidePanelOptions>,
  options?: { imgBase?: string | null; panelParams?: PanelConfig["params"] },
) => {
  return buildSlideLikeUrl("slide_mode", panelUrl, updates, options);
};

export const buildMatrixModeUrl = (
  panelUrl: PanelConfig["url"],
  updates: Partial<SlidePanelOptions>,
  options?: { imgBase?: string | null; panelParams?: PanelConfig["params"] },
) => {
  return buildSlideLikeUrl("matrix_mode", panelUrl, updates, options);
};

const buildSlideLikeUrl = (
  modeKey: "slide_mode" | "matrix_mode",
  panelUrl: PanelConfig["url"],
  updates: Partial<SlidePanelOptions>,
  options?: { imgBase?: string | null; panelParams?: PanelConfig["params"] },
) => {
  const url = toUrl(panelUrl);
  const params = url.searchParams;

  MODE_FLAG_KEYS.forEach((key) => params.delete(key));
  params.set(modeKey, "true");

  const current = parseSlidePanelOptions(panelUrl, options?.panelParams);
  const merged = mergeSlideOptions(current, updates);

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
  setNumberParam(params, "top_k", merged.topK, { min: 1 });
  params.set("slide_source", merged.slideSource || SlideSourceMode.VECTOR);
  setNumberParam(params, "kinship_depth", merged.kinshipDepth, { min: -1 });
  const orderValue = merged.kinshipOrder?.length ? merged.kinshipOrder.join(",") : "";
  if (orderValue) {
    params.set("kinship_order", orderValue);
  } else {
    params.delete("kinship_order");
  }
  if (merged.includeDeprecated !== undefined) {
    params.set("include_deprecated", merged.includeDeprecated ? "true" : "false");
  }

  const qs = params.toString();
  return `${url.pathname}${qs ? `?${qs}` : ""}`;
};

export const mergeSlideOptions = (
  current: SlidePanelOptions,
  patch?: Partial<SlidePanelOptions>,
): SlidePanelOptions => {
  const baseOrder = parseKinshipOrder(current.kinshipOrder as KinshipRelation[] | string | undefined);
  const nextOrder =
    patch?.kinshipOrder && patch.kinshipOrder.length
      ? parseKinshipOrder(patch.kinshipOrder)
      : patch?.kinshipOrder === null
      ? DEFAULT_KINSHIP_ORDER
      : baseOrder;
  const resolvedTopK = patch?.topK ?? current.topK ?? DEFAULT_SLIDE_TOP_K;
  const safeTopK = Number.isFinite(resolvedTopK) ? Math.max(1, Math.floor(resolvedTopK)) : DEFAULT_SLIDE_TOP_K;
  const resolvedDepth = patch?.kinshipDepth ?? current.kinshipDepth ?? DEFAULT_KINSHIP_DEPTH;
  const safeDepth = resolvedDepth === null || resolvedDepth === undefined ? DEFAULT_KINSHIP_DEPTH : Math.floor(resolvedDepth);

  return {
    ...current,
    ...patch,
    topK: safeTopK,
    slideSource: patch?.slideSource ?? current.slideSource ?? SlideSourceMode.VECTOR,
    kinshipDepth: safeDepth,
    kinshipOrder: nextOrder,
    includeDeprecated: patch?.includeDeprecated ?? current.includeDeprecated ?? false,
  };
};

export const applySlideOptionsToParams = (
  baseParams: PanelConfig["params"],
  options: SlidePanelOptions,
): PanelConfig["params"] | undefined => {
  const nextParams = { ...(baseParams || {}) } as Record<string, unknown>;
  setNumberLike(nextParams, "slide_interval", options.intervalMs);
  setNumberLike(nextParams, "slide_interval_ms", options.intervalMs);
  setNumberLike(nextParams, "top_k", options.topK);
  setNumberLike(nextParams, "kinship_depth", options.kinshipDepth);
  if (options.slideSource) {
    nextParams.slide_source = options.slideSource;
  }
  if (options.kinshipOrder && options.kinshipOrder.length) {
    nextParams.kinship_order = options.kinshipOrder.join(",");
  }
  if (options.includeDeprecated !== undefined) {
    nextParams.include_deprecated = options.includeDeprecated ? "true" : "false";
  }
  return Object.keys(nextParams).length ? nextParams : undefined;
};
