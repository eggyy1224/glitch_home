import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { computeStageWidthBounds, clamp } from "../utils/collageMath";
import { defaultImageProcessing, type CollageImageProcessing } from "../utils/collageImageProcessing";
import { defaultCollageStateUtils } from "../utils/collageStateUtils";
import type { CollageConfig } from "../utils/collageConfig";
import {
  COLLAGE_DEFAULT_COLS as DEFAULT_COLS,
  COLLAGE_DEFAULT_IMAGE_COUNT as DEFAULT_IMAGE_COUNT,
  COLLAGE_DEFAULT_ROWS as DEFAULT_ROWS,
  COLLAGE_DEFAULT_STAGE_HEIGHT as DEFAULT_STAGE_HEIGHT,
  COLLAGE_DEFAULT_STAGE_WIDTH as DEFAULT_STAGE_WIDTH,
  COLLAGE_MAX_COLS as MAX_COLS,
  COLLAGE_MAX_IMAGES as MAX_IMAGES,
  COLLAGE_MAX_ROWS as MAX_ROWS,
  COLLAGE_RATIO_MAX as RATIO_MAX,
  COLLAGE_RATIO_MIN as RATIO_MIN,
  COLLAGE_STAGE_MAX_HEIGHT as STAGE_MAX_HEIGHT,
  COLLAGE_STAGE_MAX_WIDTH as STAGE_MAX_WIDTH,
  COLLAGE_STAGE_MIN_HEIGHT as STAGE_MIN_HEIGHT,
  COLLAGE_STAGE_MIN_WIDTH as STAGE_MIN_WIDTH,
} from "../constants/collage";
import { useCollageCapture } from "./useCollageCapture";
import { useCollageImagePool } from "./useCollageImagePool";
import { useCollageImageMetrics } from "./useCollageImageMetrics";
import { useCollagePieces } from "./useCollagePieces";

const PERSIST_COLLAGE_QUERY =
  String(import.meta.env.VITE_COLLAGE_PERSIST_QUERY ?? "false").trim().toLowerCase() === "true";

export interface CollageControlsOptions {
  imagesBase?: string;
  anchorImage?: string | null;
  onCaptureReady?: ((capture: (() => Promise<Blob>) | null) => void) | null;
  remoteConfig?: CollageConfig | null;
  controlsEnabled?: boolean;
  remoteSource?: string | null;
  imageProcessing?: CollageImageProcessing;
  stateUtils?: typeof defaultCollageStateUtils;
}

type CollageStateUtils = typeof defaultCollageStateUtils;

type NumberInputEvent = React.ChangeEvent<HTMLInputElement | HTMLSelectElement>;

export function useCollageControls({
  imagesBase,
  anchorImage,
  onCaptureReady = null,
  remoteConfig = null,
  controlsEnabled = true,
  remoteSource = null,
  imageProcessing = defaultImageProcessing,
  stateUtils = defaultCollageStateUtils,
}: CollageControlsOptions) {
  const { rootRef } = useCollageCapture(onCaptureReady);
  const resizeHandleRef = useRef<HTMLDivElement | null>(null);

  const initialStageWidth = useMemo(
    () => stateUtils.readInitialParam("collage_width", DEFAULT_STAGE_WIDTH, STAGE_MIN_WIDTH, STAGE_MAX_WIDTH),
    [stateUtils],
  );
  const initialStageHeight = useMemo(
    () => stateUtils.readInitialParam("collage_height", DEFAULT_STAGE_HEIGHT, STAGE_MIN_HEIGHT, STAGE_MAX_HEIGHT),
    [stateUtils],
  );
  const initialDesiredRatio = useMemo(
    () => stateUtils.calculateDesiredRatio(initialStageWidth, initialStageHeight),
    [initialStageHeight, initialStageWidth, stateUtils],
  );

  const [seed, setSeed] = useState<number>(() => stateUtils.nextSeed());
  const [imageCount, setImageCount] = useState<number>(() =>
    stateUtils.readInitialParam("collage_images", DEFAULT_IMAGE_COUNT, 1, MAX_IMAGES),
  );
  const [rows, setRows] = useState<number>(() =>
    stateUtils.readInitialParam("collage_rows", DEFAULT_ROWS, 1, MAX_ROWS),
  );
  const [cols, setCols] = useState<number>(() =>
    stateUtils.readInitialParam("collage_cols", DEFAULT_COLS, 1, MAX_COLS),
  );
  const [mixPieces, setMixPieces] = useState<boolean>(() => stateUtils.readInitialBooleanParam("collage_mix", false));
  const [stageWidth, setStageWidth] = useState<number>(() => initialStageWidth);
  const [stageHeight, setStageHeight] = useState<number>(() => initialStageHeight);
  const [desiredRatio, setDesiredRatio] = useState<number>(() => initialDesiredRatio);
  const [remoteStageHeightSet, setRemoteStageHeightSet] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(false);

  const { imagePool, loading, error } = useCollageImagePool({
    anchorImage,
    remoteConfig,
    setImageCount,
    setRows,
    setCols,
    setMixPieces,
    setSeed,
    setStageWidth,
    setStageHeight,
    setDesiredRatio,
    setRemoteStageHeightSet,
  });

  const maxSelectableImages = useMemo(() => {
    if (!imagePool.length) return 1;
    return Math.min(MAX_IMAGES, imagePool.length);
  }, [imagePool]);

  const imageCountMax = useMemo(() => Math.max(1, maxSelectableImages), [maxSelectableImages]);

  const selectedImages = useMemo(() => {
    if (!imagePool.length) return [];
    const limit = Math.min(imageCount, imagePool.length);
    return imagePool.slice(0, limit);
  }, [imagePool, imageCount]);

  const {
    totalPieces,
    mixBoard,
    boardRatio,
    piecesByImage,
    mixedPieces,
    edgeStatus,
    edgesReady,
  } = useCollagePieces({
    selectedImages,
    rows,
    cols,
    seed,
    mixPieces,
    desiredRatio,
    imagesBase,
    imageProcessing,
  });

  const { imageMetrics } = useCollageImageMetrics({
    selectedImages,
    imagesBase,
    imageProcessing,
  });

  const stageWidthBounds = useMemo(() => computeStageWidthBounds(boardRatio), [boardRatio]);
  const computedStageHeight = useMemo(() => stageWidth * boardRatio, [stageWidth, boardRatio]);
  const finalStageHeight = remoteStageHeightSet ? stageHeight : computedStageHeight;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const params = url.searchParams;
    const before = params.toString();

    if (!PERSIST_COLLAGE_QUERY) {
      let modified = false;
      params.forEach((_, key) => {
        if (key.startsWith("collage_") && key !== "collage_mode") {
          params.delete(key);
          modified = true;
        }
      });
      if (modified) {
        const next = params.toString();
        window.history.replaceState(null, "", next ? `${url.pathname}?${next}` : url.pathname);
      }
      return;
    }

    const applyParam = (key: string, value: string | number | boolean, defaultValue: string | number | boolean) => {
      if (value === undefined || value === null || String(value) === String(defaultValue)) {
        if (params.has(key)) {
          params.delete(key);
        }
        return;
      }
      params.set(key, String(value));
    };

    applyParam("collage_images", imageCount, DEFAULT_IMAGE_COUNT);
    applyParam("collage_rows", rows, DEFAULT_ROWS);
    applyParam("collage_cols", cols, DEFAULT_COLS);
    applyParam("collage_mix", mixPieces ? "true" : "false", "false");

    if (mixPieces) {
      applyParam("collage_width", Math.round(stageWidth), DEFAULT_STAGE_WIDTH);
      applyParam("collage_height", Math.round(finalStageHeight), DEFAULT_STAGE_HEIGHT);
    } else {
      if (params.has("collage_width")) params.delete("collage_width");
      if (params.has("collage_height")) params.delete("collage_height");
    }

    const after = params.toString();
    if (after !== before) {
      window.history.replaceState(null, "", after ? `${url.pathname}?${after}` : url.pathname);
    }
  }, [imageCount, rows, cols, mixPieces, stageWidth, finalStageHeight]);

  useEffect(() => {
    let changed = false;
    setImageCount((prev) => {
      const next = clamp(prev, 1, maxSelectableImages);
      if (next !== prev) {
        changed = true;
      }
      return next;
    });
    if (changed) {
      setSeed(stateUtils.nextSeed());
    }
  }, [maxSelectableImages, stateUtils]);

  useEffect(() => {
    setStageWidth((prev) => {
      const clamped = clamp(prev, stageWidthBounds.min, stageWidthBounds.max);
      if (Math.abs(clamped - prev) < 0.5) {
        return prev;
      }
      return clamped;
    });
  }, [stageWidthBounds]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && (event.key === "r" || event.key === "R")) {
        event.preventDefault();
        setControlsVisible((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown, { passive: false });
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const extractNumeric = (eventOrValue: number | string | NumberInputEvent | null | undefined): number => {
    if (typeof eventOrValue === "number") return eventOrValue;
    const raw = typeof eventOrValue === "string" ? eventOrValue : eventOrValue?.target?.value;
    return Number.parseInt(raw ?? "", 10);
  };

  const handleImageCountChange = useCallback(
    (eventOrValue: number | NumberInputEvent) => {
      if (!controlsEnabled) return;
      const parsed = extractNumeric(eventOrValue);
      if (Number.isNaN(parsed)) return;
      setImageCount(clamp(parsed, 1, maxSelectableImages));
      setSeed(stateUtils.nextSeed());
    },
    [controlsEnabled, maxSelectableImages, stateUtils],
  );

  const handleRowsChange = useCallback(
    (eventOrValue: number | NumberInputEvent) => {
      if (!controlsEnabled) return;
      const parsed = extractNumeric(eventOrValue);
      if (Number.isNaN(parsed)) return;
      setRows(clamp(parsed, 1, MAX_ROWS));
      setSeed(stateUtils.nextSeed());
    },
    [controlsEnabled, stateUtils],
  );

  const handleColsChange = useCallback(
    (eventOrValue: number | NumberInputEvent) => {
      if (!controlsEnabled) return;
      const parsed = extractNumeric(eventOrValue);
      if (Number.isNaN(parsed)) return;
      setCols(clamp(parsed, 1, MAX_COLS));
      setSeed(stateUtils.nextSeed());
    },
    [controlsEnabled, stateUtils],
  );

  const toggleMixPieces = useCallback(() => {
    if (!controlsEnabled) return;
    setMixPieces((prev) => !prev);
    setSeed(stateUtils.nextSeed());
  }, [controlsEnabled, stateUtils]);

  const handleShuffle = useCallback(() => {
    if (!controlsEnabled) return;
    setSeed(stateUtils.nextSeed());
  }, [controlsEnabled, stateUtils]);

  const latestBoundsRef = useRef(stageWidthBounds);
  useEffect(() => {
    latestBoundsRef.current = stageWidthBounds;
  }, [stageWidthBounds]);

  const handleResizePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!controlsEnabled) return;
      if (event.button !== 0) return;
      event.preventDefault();
      const startX = event.clientX;
      const startY = event.clientY;
      const bounds = latestBoundsRef.current;
      const startWidth = stageWidth;
      const startHeight = finalStageHeight;

      const onPointerMove = (moveEvent: PointerEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;
        const currentBounds = latestBoundsRef.current || bounds;
        const nextWidth = clamp(startWidth + deltaX, currentBounds.min, currentBounds.max);
        const rawHeight = clamp(startHeight + deltaY, STAGE_MIN_HEIGHT, STAGE_MAX_HEIGHT);
        setStageWidth(nextWidth);
        const nextRatio = clamp(rawHeight / Math.max(nextWidth, 1), RATIO_MIN, RATIO_MAX);
        setDesiredRatio(nextRatio);
      };

      const onPointerUp = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp, { once: true });
    },
    [controlsEnabled, stageWidth, finalStageHeight],
  );

  const stageClassName = mixPieces ? "collage-stage collage-stage--mixed" : "collage-stage";

  return {
    rootRef,
    resizeHandleRef,
    stageClassName,
    controlsVisible,
    controlsEnabled,
    remoteSource,
    loading,
    error,
    imagePool,
    selectedImages,
    piecesByImage,
    imageMetrics,
    mixPieces,
    mixBoard,
    mixedPieces,
    edgesReady,
    edgeStatus,
    rows,
    cols,
    imageCount,
    totalPieces,
    stageWidth,
    finalStageHeight,
    handleImageCountChange,
    handleRowsChange,
    handleColsChange,
    toggleMixPieces,
    handleShuffle,
    handleResizePointerDown,
    imageCountMax,
  };
}
