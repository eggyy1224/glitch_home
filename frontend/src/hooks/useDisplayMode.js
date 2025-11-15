import { useMemo } from "react";

export const DisplayModes = Object.freeze({
  KINSHIP: "kinship",
  IFRAME: "iframe",
  SLIDE: "slide",
  ORGANIC: "organic",
  SEARCH: "search",
  COLLAGE: "collage",
  CAPTION: "caption",
  COLLAGE_VERSION: "collage_version",
  GENERATE: "generate",
  STATIC: "static",
  VIDEO: "video",
});

const PARAM_SEQUENCE = [
  { type: DisplayModes.IFRAME, key: "iframe_mode" },
  { type: DisplayModes.SLIDE, key: "slide_mode" },
  { type: DisplayModes.ORGANIC, key: "organic_mode" },
  { type: DisplayModes.SEARCH, key: "search_mode" },
  { type: DisplayModes.COLLAGE, key: "collage_mode" },
  { type: DisplayModes.CAPTION, key: "caption_mode" },
  { type: DisplayModes.COLLAGE_VERSION, key: "collage_version_mode" },
  { type: DisplayModes.GENERATE, key: "generate_mode" },
  { type: DisplayModes.STATIC, key: "static_mode" },
  { type: DisplayModes.VIDEO, key: "video_mode" },
];

const parseBooleanParam = (params, key, defaultValue = "false") => {
  const rawValue = params?.get(key);
  return (rawValue ?? defaultValue) === "true";
};

export const getActiveMode = (params) => {
  const incubatorMode = parseBooleanParam(params, "incubator");
  const phylogenyMode = parseBooleanParam(params, "phylogeny");

  if (incubatorMode) {
    return { type: DisplayModes.KINSHIP, config: { incubator: true, phylogeny: phylogenyMode } };
  }

  for (const entry of PARAM_SEQUENCE) {
    if (parseBooleanParam(params, entry.key)) {
      return { type: entry.type, config: { incubator: false, phylogeny: phylogenyMode } };
    }
  }

  if (phylogenyMode) {
    return { type: DisplayModes.KINSHIP, config: { incubator: false, phylogeny: phylogenyMode } };
  }

  return { type: DisplayModes.KINSHIP, config: { incubator: false, phylogeny: phylogenyMode } };
};

export const useDisplayMode = (initialParams) => {
  return useMemo(() => {
    const params = initialParams || new URLSearchParams(window.location.search);
    return getActiveMode(params);
  }, [initialParams]);
};
