import type { OverlayContent } from "../../src/types/overlay";
import type { CollageConfig } from "../../src/utils/collageConfig";
import type { IframeConfig, IframePanelConfig } from "../../src/types/control";
import {
  COLLAGE_DEFAULT_COLS,
  COLLAGE_DEFAULT_IMAGE_COUNT,
  COLLAGE_DEFAULT_ROWS,
  COLLAGE_DEFAULT_STAGE_HEIGHT,
  COLLAGE_DEFAULT_STAGE_WIDTH,
} from "../../src/constants/collage";

const baseOverlayContent: OverlayContent = {
  text: "demo subtitle",
  language: "zh-TW",
  durationSeconds: 3,
  expiresAt: null,
  updatedAt: null,
};

export function createOverlayContent(overrides: Partial<OverlayContent> = {}): OverlayContent {
  return {
    ...baseOverlayContent,
    ...overrides,
  };
}

const baseIframePanelConfig: IframePanelConfig = {
  id: "panel-1",
  src: "https://example.com/embed",
  ratio: 1,
  label: "Panel 1",
  colSpan: 1,
  rowSpan: 1,
};

export function createIframePanelConfig(overrides: Partial<IframePanelConfig> = {}): IframePanelConfig {
  return {
    ...baseIframePanelConfig,
    ...overrides,
  };
}

const baseIframeConfig: IframeConfig = {
  id: "iframe-demo",
  layout: "grid",
  gap: 8,
  columns: 3,
  panels: [createIframePanelConfig()],
};

export function createIframeConfig(overrides: Partial<IframeConfig> = {}): IframeConfig {
  return {
    ...baseIframeConfig,
    ...overrides,
    panels: overrides.panels ?? baseIframeConfig.panels.map((panel) => ({ ...panel })),
  };
}

const baseCollageConfig: CollageConfig = {
  images: ["a.jpg", "b.jpg"],
  image_count: COLLAGE_DEFAULT_IMAGE_COUNT,
  rows: COLLAGE_DEFAULT_ROWS,
  cols: COLLAGE_DEFAULT_COLS,
  mix: false,
  stage_width: COLLAGE_DEFAULT_STAGE_WIDTH,
  stage_height: COLLAGE_DEFAULT_STAGE_HEIGHT,
  seed: 123,
};

export function createCollageConfig(overrides: Partial<CollageConfig> = {}): CollageConfig {
  return {
    ...baseCollageConfig,
    ...overrides,
    images: overrides.images ?? [...baseCollageConfig.images],
  };
}
