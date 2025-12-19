import { useMemo } from "react";
import { clampInt } from "../utils/iframeConfig";
import { DisplayModes, useDisplayMode, type DisplayModeType } from "./useDisplayMode";

const DEFAULT_SLIDE_INTERVAL = 3000;
const MIN_SLIDE_INTERVAL = 1000;

export const KINSHIP_DATA_EXCLUDED: Set<DisplayModeType> = new Set([
  DisplayModes.ORGANIC,
  DisplayModes.MATRIX,
  DisplayModes.SLIDE,
  DisplayModes.IFRAME,
  DisplayModes.STATIC,
  DisplayModes.VIDEO,
  DisplayModes.ADMIN,
  DisplayModes.EXHIBITION,
]);

export const readSearchParams = () => new URLSearchParams(window.location.search);

export interface ModeParamsResult {
  activeMode: DisplayModeType;
  modeConfig: Record<string, unknown> | null;
  incubatorMode: boolean;
  phylogenyMode: boolean;
  initialParams: URLSearchParams;
  initialImg: string | null;
  soundPlayerEnabled: boolean;
  slideIntervalMs: number;
  clientId: string;
  iframeTimelineId: string | null;
  shouldLoadKinshipData: boolean;
}

export function useModeParams(): ModeParamsResult {
  const initialParams = useMemo(() => readSearchParams(), []);
  const { type, config } = useDisplayMode(initialParams);
  const incubatorMode = Boolean(config?.incubator);
  const phylogenyMode = Boolean(config?.phylogeny);
  const initialImg = initialParams.get("img");

  const soundPlayerEnabled = useMemo(() => {
    const rawValue = initialParams.get("sound_player");
    return (rawValue ?? "true") !== "false";
  }, [initialParams]);

  const slideIntervalMs = useMemo(() => {
    const slideIntervalParam = initialParams.get("slide_interval") || initialParams.get("slide_interval_ms");
    return slideIntervalParam
      ? clampInt(slideIntervalParam, DEFAULT_SLIDE_INTERVAL, { min: MIN_SLIDE_INTERVAL }) ?? DEFAULT_SLIDE_INTERVAL
      : DEFAULT_SLIDE_INTERVAL;
  }, [initialParams]);

  const clientId = useMemo(() => {
    const params = readSearchParams();
    const fromQuery = params.get("client");
    if (fromQuery && fromQuery.trim()) return fromQuery.trim();
    const fromEnv = import.meta?.env?.VITE_CLIENT_ID;
    if (fromEnv && `${fromEnv}`.trim()) return `${fromEnv}`.trim();
    if (type === DisplayModes.ADMIN) return "admin";
    return "default";
  }, [type]);

  const iframeTimelineId = useMemo(() => {
    const fromQuery = initialParams.get("iframe_timeline");
    if (fromQuery && fromQuery.trim()) {
      return fromQuery.trim();
    }
    return null;
  }, [initialParams]);

  const shouldLoadKinshipData = !KINSHIP_DATA_EXCLUDED.has(type);

  return {
    activeMode: type,
    modeConfig: config,
    incubatorMode,
    phylogenyMode,
    initialParams,
    initialImg,
    soundPlayerEnabled,
    slideIntervalMs,
    clientId,
    iframeTimelineId,
    shouldLoadKinshipData,
  };
}
