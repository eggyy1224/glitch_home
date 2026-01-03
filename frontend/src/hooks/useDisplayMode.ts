import { useMemo } from "react";

export const DisplayModes = {
  KINSHIP: "kinship",
  IFRAME: "iframe",
  MATRIX: "matrix",
  SLIDE: "slide",
  VJ: "vj",
  VJ_VIDEO: "vj_video",
  ORGANIC: "organic",
  SEARCH: "search",
  COLLAGE: "collage",
  CAPTION: "caption",
  COLLAGE_VERSION: "collage_version",
  GENERATE: "generate",
  STATIC: "static",
  VIDEO: "video",
  ADMIN: "admin",
  EXHIBITION: "exhibition",
} as const;

export type DisplayModeType = (typeof DisplayModes)[keyof typeof DisplayModes];

const PARAM_SEQUENCE: Array<{ type: DisplayModeType; key: string }> = [
  { type: DisplayModes.ADMIN, key: "admin_mode" },
  { type: DisplayModes.EXHIBITION, key: "exhibition_mode" },
  { type: DisplayModes.IFRAME, key: "iframe_mode" },
  { type: DisplayModes.MATRIX, key: "matrix_mode" },
  { type: DisplayModes.SLIDE, key: "slide_mode" },
  { type: DisplayModes.VJ_VIDEO, key: "vj_video_mode" },
  { type: DisplayModes.VJ, key: "vj_mode" },
  { type: DisplayModes.ORGANIC, key: "organic_mode" },
  { type: DisplayModes.SEARCH, key: "search_mode" },
  { type: DisplayModes.COLLAGE, key: "collage_mode" },
  { type: DisplayModes.CAPTION, key: "caption_mode" },
  { type: DisplayModes.COLLAGE_VERSION, key: "collage_version_mode" },
  { type: DisplayModes.GENERATE, key: "generate_mode" },
  { type: DisplayModes.STATIC, key: "static_mode" },
  { type: DisplayModes.VIDEO, key: "video_mode" },
];

const parseBooleanParam = (params: URLSearchParams | undefined, key: string, defaultValue = "false") => {
  const rawValue = params?.get(key);
  return (rawValue ?? defaultValue) === "true";
};

const buildKinshipConfig = (incubatorMode: boolean, phylogenyMode: boolean) => ({
  incubator: incubatorMode,
  phylogeny: phylogenyMode,
});

export const getActiveMode = (params?: URLSearchParams) => {
  const incubatorMode = parseBooleanParam(params, "incubator");
  const phylogenyMode = parseBooleanParam(params, "phylogeny");

  const modePriority = [
    { type: DisplayModes.KINSHIP, isActive: () => incubatorMode },
    ...PARAM_SEQUENCE.map((entry) => ({
      type: entry.type,
      isActive: () => parseBooleanParam(params, entry.key),
    })),
    { type: DisplayModes.KINSHIP, isActive: () => phylogenyMode },
  ];

  const activeType = modePriority.find((entry) => entry.isActive())?.type ?? DisplayModes.KINSHIP;

  return { type: activeType, config: buildKinshipConfig(incubatorMode, phylogenyMode) };
};

export const useDisplayMode = (initialParams?: URLSearchParams) => {
  return useMemo(() => {
    const params = initialParams || new URLSearchParams(window.location.search);
    return getActiveMode(params);
  }, [initialParams]);
};
