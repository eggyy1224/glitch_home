import type { SnapshotPanel } from "../../types/admin";

export const MODE_PRESETS = {
  slide_mode: { assetKey: "img", label: "slide_mode (輪播)" },
  static_mode: { assetKey: "img", label: "static_mode (單張)" },
  video_mode: { assetKey: "video", label: "video_mode (影片)" },
} as const;

export type PanelMode = keyof typeof MODE_PRESETS;

const truthy = (value: unknown): boolean => {
  if (value == null) return false;
  const text = String(value).toLowerCase();
  return text === "true" || text === "1" || text === "yes";
};

export const getPanelModeAndAsset = (panel?: SnapshotPanel | null) => {
  let mode: PanelMode | "" = "";
  let asset = panel?.image || "";
  const base = typeof window !== "undefined" ? window.location.origin : "http://localhost";
  if (panel?.url) {
    try {
      const parsed = new URL(panel.url, base);
      const params = parsed.searchParams;
      (Object.keys(MODE_PRESETS) as PanelMode[]).some((key) => {
        if (!truthy(params.get(key))) return false;
        mode = key;
        const assetKey = MODE_PRESETS[key].assetKey;
        asset = params.get(assetKey) || asset;
        return true;
      });
      if (!mode) {
        const imgParam = params.get("img");
        if (imgParam) {
          asset = imgParam;
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
  qs.set(mode, "true");
  if (asset) {
    qs.set(preset.assetKey, asset);
  }
  return `/?${qs.toString()}`;
};
