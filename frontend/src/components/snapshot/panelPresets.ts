import type { SnapshotPanel } from "../../types/admin";

type ModePreset = {
  assetKey: "img" | "video";
  label: string;
  flagKey: string | null;
};

export const PRESET_MODE_KEY = "__preset_mode";

export const MODE_PRESETS = {
  slide_mode: { assetKey: "img", label: "slide_mode (輪播)", flagKey: "slide_mode" },
  static_mode: { assetKey: "img", label: "static_mode (單張)", flagKey: "static_mode" },
  video_mode: { assetKey: "video", label: "video_mode (影片)", flagKey: "video_mode" },
  incubator: { assetKey: "img", label: "incubator (孵化室)", flagKey: "incubator" },
  default: { assetKey: "img", label: "預設模式（無後綴）", flagKey: null },
} as const satisfies Record<string, ModePreset>;

export type PanelMode = keyof typeof MODE_PRESETS;

const truthy = (value: unknown): boolean => {
  if (value == null) return false;
  const text = String(value).toLowerCase();
  return text === "true" || text === "1" || text === "yes";
};

const normalizeMode = (value: unknown): PanelMode | "" => {
  if (typeof value !== "string") return "";
  return Object.prototype.hasOwnProperty.call(MODE_PRESETS, value) ? (value as PanelMode) : "";
};

export const mergePresetMode = (params: Record<string, unknown> | undefined, mode: PanelMode | "") => {
  const next: Record<string, unknown> = params ? { ...params } : {};
  if (mode) {
    next[PRESET_MODE_KEY] = mode;
  } else {
    delete next[PRESET_MODE_KEY];
  }
  return Object.keys(next).length ? next : undefined;
};

export const getPanelModeAndAsset = (panel?: SnapshotPanel | null) => {
  const presetModeHint = normalizeMode(panel?.params ? (panel.params as Record<string, unknown>)[PRESET_MODE_KEY] : undefined);
  let mode: PanelMode | "" = presetModeHint;
  let asset = panel?.image || "";
  const base = typeof window !== "undefined" ? window.location.origin : "http://localhost";
  const presetEntries = Object.entries(MODE_PRESETS) as Array<[PanelMode, ModePreset]>;
  const defaultModeKey = presetEntries.find(([, preset]) => preset.flagKey === null)?.[0];
  if (panel?.url) {
    try {
      const parsed = new URL(panel.url, base);
      const params = parsed.searchParams;
      const flagged = presetEntries.find(([, preset]) => preset.flagKey && truthy(params.get(preset.flagKey)));
      if (flagged) {
        const [matchedMode, preset] = flagged;
        mode = matchedMode;
        asset = params.get(preset.assetKey) || asset || params.get("img") || "";
      } else {
        const imgParam = params.get("img");
        if (imgParam) {
          asset = imgParam;
          if (defaultModeKey) {
            mode = defaultModeKey;
          }
        }
      }
    } catch (err) {
      // ignore parse errors and fall back to manual inputs
    }
  }
  if (!mode && panel?.image) {
    mode = "static_mode";
  }
  return { mode, asset };
};

export const buildUrlFromPreset = (mode: PanelMode, asset: string) => {
  const preset = MODE_PRESETS[mode];
  if (!preset) return "";
  const qs = new URLSearchParams();
  if (preset.flagKey) {
    qs.set(preset.flagKey, "true");
  }
  if (asset) {
    qs.set(preset.assetKey, asset);
  }
  const queryString = qs.toString();
  return queryString ? `/?${queryString}` : "/";
};
