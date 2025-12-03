import { useEffect, useRef, useState } from "react";
import { fetchKinship } from "../api";
import {
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
import { buildImagePool, clamp, cleanCollageId } from "../utils/collageMath";
import type { CollageConfig } from "../utils/collageConfig";

interface UseCollageImagePoolOptions {
  anchorImage?: string | null;
  remoteConfig?: CollageConfig | null;
  setImageCount: React.Dispatch<React.SetStateAction<number>>;
  setRows: React.Dispatch<React.SetStateAction<number>>;
  setCols: React.Dispatch<React.SetStateAction<number>>;
  setMixPieces: React.Dispatch<React.SetStateAction<boolean>>;
  setSeed: React.Dispatch<React.SetStateAction<number>>;
  setStageWidth: React.Dispatch<React.SetStateAction<number>>;
  setStageHeight: React.Dispatch<React.SetStateAction<number>>;
  setDesiredRatio: React.Dispatch<React.SetStateAction<number>>;
  setRemoteStageHeightSet: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useCollageImagePool({
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
}: UseCollageImagePoolOptions) {
  const [imagePool, setImagePool] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedPoolRef = useRef<string[]>([]);
  const remoteOverrideRef = useRef(false);
  const [remoteOverrideActive, setRemoteOverrideActive] = useState(false);

  useEffect(() => {
    remoteOverrideRef.current = remoteOverrideActive;
  }, [remoteOverrideActive]);

  useEffect(() => {
    let cancelled = false;
    const cleanAnchor = cleanCollageId(anchorImage);

    if (!cleanAnchor) {
      if (!remoteOverrideRef.current) {
        setImagePool([]);
        setError("請在網址加上 ?img=檔名 以啟動拼貼模式。");
      } else {
        setError(null);
      }
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setError(null);

    const run = async () => {
      try {
        const data = await fetchKinship(cleanAnchor, -1);
        if (cancelled) return;
        const pool = buildImagePool(data as Parameters<typeof buildImagePool>[0], cleanAnchor);
        const nextPool = pool.length ? pool : [cleanAnchor];
        fetchedPoolRef.current = nextPool;
        if (!remoteOverrideRef.current) {
          setImagePool(nextPool);
          if (!pool.length) {
            setError("沒有找到關聯圖像，改以原圖拼貼。");
          }
        } else if (!pool.length) {
          setError("沒有找到關聯圖像，改以原圖拼貼。");
        }
      } catch (err) {
        if (cancelled) return;
        const fallbackPool = cleanAnchor ? [cleanAnchor] : [];
        fetchedPoolRef.current = fallbackPool;
        if (!remoteOverrideRef.current) {
          setImagePool(fallbackPool);
        }
        const message = err instanceof Error ? err.message : "載入圖像清單失敗";
        setError(message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [anchorImage]);

  useEffect(() => {
    if (!remoteConfig) {
      if (remoteOverrideRef.current) {
        setRemoteOverrideActive(false);
        setImagePool(fetchedPoolRef.current);
      }
      setRemoteStageHeightSet(false);
      return;
    }

    const nextImages = Array.isArray(remoteConfig.images) ? remoteConfig.images : [];
    if (nextImages.length) {
      setRemoteOverrideActive(true);
      setImagePool(nextImages);
      setError(null);
      setLoading(false);
    } else if (remoteOverrideRef.current) {
      setRemoteOverrideActive(false);
      setImagePool(fetchedPoolRef.current);
    }

    if (typeof remoteConfig.image_count === "number") {
      const targetCount = clamp(remoteConfig.image_count, 1, MAX_IMAGES);
      setImageCount((prev) => (prev === targetCount ? prev : targetCount));
    }

    if (typeof remoteConfig.rows === "number") {
      const targetRows = clamp(remoteConfig.rows, 1, MAX_ROWS);
      setRows((prev) => (prev === targetRows ? prev : targetRows));
    }

    if (typeof remoteConfig.cols === "number") {
      const targetCols = clamp(remoteConfig.cols, 1, MAX_COLS);
      setCols((prev) => (prev === targetCols ? prev : targetCols));
    }

    if (typeof remoteConfig.mix === "boolean") {
      const mixValue = Boolean(remoteConfig.mix);
      setMixPieces((prev) => (prev === mixValue ? prev : mixValue));
    }

    if (remoteConfig.seed !== undefined && remoteConfig.seed !== null) {
      const targetSeed = Math.floor(remoteConfig.seed);
      setSeed((prev) => (prev === targetSeed ? prev : targetSeed));
    }

    if (typeof remoteConfig.stage_width === "number") {
      const clampedWidth = clamp(remoteConfig.stage_width, STAGE_MIN_WIDTH, STAGE_MAX_WIDTH);
      setStageWidth((prev) => (Math.abs(prev - clampedWidth) < 0.5 ? prev : clampedWidth));
    }

    if (typeof remoteConfig.stage_height === "number") {
      const clampedHeight = clamp(remoteConfig.stage_height, STAGE_MIN_HEIGHT, STAGE_MAX_HEIGHT);
      setStageHeight((prev) => (Math.abs(prev - clampedHeight) < 0.5 ? prev : clampedHeight));
      setRemoteStageHeightSet(true);
    } else if (remoteConfig.stage_height === null || remoteConfig.stage_height === undefined) {
      setRemoteStageHeightSet(false);
    }

    if (
      typeof remoteConfig.stage_width === "number" &&
      typeof remoteConfig.stage_height === "number" &&
      remoteConfig.stage_width > 0
    ) {
      const nextRatio = clamp(
        remoteConfig.stage_height / Math.max(remoteConfig.stage_width, 1),
        RATIO_MIN,
        RATIO_MAX,
      );
      setDesiredRatio((prev) => (Math.abs(prev - nextRatio) < 0.001 ? prev : nextRatio));
    }
  }, [remoteConfig, setCols, setDesiredRatio, setImageCount, setMixPieces, setRemoteStageHeightSet, setRows, setSeed, setStageHeight, setStageWidth]);

  return { imagePool, loading, error };
}
