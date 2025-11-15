import { useMemo } from "react";
import { clampInt } from "../utils/iframeConfig.js";
import { DisplayModes, useDisplayMode } from "./useDisplayMode.js";

const DEFAULT_SLIDE_INTERVAL = 3000;
const MIN_SLIDE_INTERVAL = 1000;

const KINSHIP_DATA_EXCLUDED = new Set([
  DisplayModes.ORGANIC,
  DisplayModes.SLIDE,
  DisplayModes.IFRAME,
  DisplayModes.STATIC,
  DisplayModes.VIDEO,
]);

export const readSearchParams = () => new URLSearchParams(window.location.search);

export function useModeParams() {
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
      ? clampInt(slideIntervalParam, DEFAULT_SLIDE_INTERVAL, { min: MIN_SLIDE_INTERVAL })
      : DEFAULT_SLIDE_INTERVAL;
  }, [initialParams]);

  const clientId = useMemo(() => {
    const params = readSearchParams();
    const fromQuery = params.get("client");
    if (fromQuery && fromQuery.trim()) return fromQuery.trim();
    const fromEnv = import.meta?.env?.VITE_CLIENT_ID;
    if (fromEnv && `${fromEnv}`.trim()) return `${fromEnv}`.trim();
    return "default";
  }, []);

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
    shouldLoadKinshipData,
  };
}
