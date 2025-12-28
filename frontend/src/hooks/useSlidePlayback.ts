import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { searchImagesByImage, fetchKinship } from "../api";
import { parseSlidePanelOptions } from "../components/snapshot/slidePanelUtils";
import {
  DEFAULT_KINSHIP_DEPTH,
  DEFAULT_KINSHIP_ORDER,
  DEFAULT_SLIDE_TOP_K,
  SlideSourceMode,
  buildDisplayOrder,
  cleanId,
  getSlideSourceMode,
} from "../utils/slideMode";

interface SlideItem {
  id: string;
  cleanId: string;
  distance: number | null;
}

const TRUTHY_VALUES = new Set(["1", "true", "yes", "on"]);

const isTruthyParam = (value: string | null | undefined): boolean => {
  if (!value) return false;
  return TRUTHY_VALUES.has(value.trim().toLowerCase());
};

const isInIframe = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch (err) {
    return true;
  }
};

const hashString = (value: string): number => {
  // FNV-1a 32-bit
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const resolveInstanceSeed = (): number => {
  if (typeof window === "undefined") return 0.5;
  const candidates: string[] = [];
  try {
    const frameTitle = window.frameElement?.getAttribute?.("title");
    if (frameTitle) candidates.push(frameTitle);
  } catch (err) {
    // ignore cross-origin frame access
  }
  if (window.name) candidates.push(window.name);
  const key = candidates.find((value) => value && value.trim());
  if (key) {
    return hashString(key) / 4294967296;
  }
  return Math.random();
};

const ensureArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const deduplicate = (entries: SlideItem[]): SlideItem[] => {
  const seen = new Set<string>();
  const ordered: SlideItem[] = [];
  entries.forEach((entry) => {
    if (!entry?.cleanId || seen.has(entry.cleanId)) {
      return;
    }
    ordered.push(entry);
    seen.add(entry.cleanId);
  });
  return ordered;
};

const buildVectorResults = (list: unknown, fallbackId: string | null | undefined, limit: number): SlideItem[] => {
  const prepared = ensureArray<{ id?: string; distance?: number }>(list)
    .map((item) => {
      const cleaned = cleanId(item?.id || "") || "";
      return {
        id: item?.id || "",
        cleanId: cleaned,
        distance: typeof item?.distance === "number" ? item.distance : null,
      };
    })
    .filter((entry) => entry.cleanId);

  const orderedByDisplay: SlideItem[] = [];
  buildDisplayOrder(limit).forEach((index) => {
    const entry = prepared[index];
    if (!entry) return;
    orderedByDisplay.push(entry);
  });

  const deduped = deduplicate([...orderedByDisplay, ...prepared]);

  if (fallbackId && !deduped.find((entry) => entry.cleanId === fallbackId)) {
    deduped.unshift({ id: fallbackId, cleanId: fallbackId, distance: null });
  }

  return deduped.slice(0, limit);
};

const buildKinshipResults = (
  data: unknown,
  fallbackId: string | null | undefined,
  limit: number,
  order: typeof DEFAULT_KINSHIP_ORDER,
): SlideItem[] => {
  const ordered: SlideItem[] = [];
  const pushList = (list: unknown): void => {
    ensureArray<string>(list).forEach((item) => {
      const clean = cleanId(item) || "";
      if (!clean) return;
      ordered.push({ id: clean, cleanId: clean, distance: null });
    });
  };

  const payload = (data || {}) as Record<string, unknown>;
  const applyAncestors = () => {
    ensureArray(payload.ancestors_by_level).forEach((level) => pushList(level));
    pushList(payload.ancestors);
  };
  order.forEach((relation) => {
    if (relation === "ancestors") {
      applyAncestors();
    } else {
      pushList(payload[relation]);
    }
  });
  pushList(payload.related_images);

  const list = deduplicate(ordered);
  const original = cleanId((payload.original_image as string) || fallbackId);
  if (original) {
    list.unshift({ id: original, cleanId: original, distance: null });
  }

  const sliced = list.slice(0, limit);
  if (!sliced.length && original) {
    sliced.push({ id: original, cleanId: original, distance: null });
  }
  return sliced;
};

export function useSlidePlayback({
  anchorImage,
  intervalMs = 3000,
  searchByImage = searchImagesByImage,
  fetchKinshipData = fetchKinship,
  imagesBase = "/generated_images/", // Default base path
  defaultTopK,
}: {
  anchorImage?: string | null | undefined;
  intervalMs?: number;
  searchByImage?: typeof searchImagesByImage;
  fetchKinshipData?: typeof fetchKinship;
  imagesBase?: string;
  defaultTopK?: number;
} = {}) {
  const anchorClean = cleanId(anchorImage);
  const slideConfig = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const parsed = parseSlidePanelOptions(window.location.href);
    const resolvedTopK = Math.max(1, Math.floor(parsed.topK ?? DEFAULT_SLIDE_TOP_K));
    const fallbackTopK =
      Number.isFinite(defaultTopK) && defaultTopK !== null && defaultTopK !== undefined
        ? Math.max(1, Math.floor(defaultTopK))
        : null;
    const effectiveTopK = !params.has("top_k") && fallbackTopK ? fallbackTopK : resolvedTopK;
    const resolvedDepth =
      parsed.kinshipDepth === null || parsed.kinshipDepth === undefined
        ? DEFAULT_KINSHIP_DEPTH
        : Math.floor(parsed.kinshipDepth);
    const kinshipOrder =
      parsed.kinshipOrder && parsed.kinshipOrder.length ? parsed.kinshipOrder : DEFAULT_KINSHIP_ORDER;
    return {
      ...parsed,
      topK: effectiveTopK,
      slideSource: parsed.slideSource ?? SlideSourceMode.VECTOR,
      kinshipDepth: resolvedDepth,
      kinshipOrder,
      includeDeprecated: parsed.includeDeprecated ?? false,
      continuous: isTruthyParam(params.get("continuous")),
    };
  }, [defaultTopK]);
  const [items, setItems] = useState<SlideItem[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);
  const [showCaption, setShowCaption] = useState(false);
  const [sourceMode, setSourceMode] = useState(slideConfig.slideSource);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const failedSetRef = useRef<Set<string>>(new Set());
  const latestItemsRef = useRef<SlideItem[]>([]);
  const retryAttemptRef = useRef(0);
  const instanceSeedRef = useRef<number | null>(null);
  if (instanceSeedRef.current === null) {
    instanceSeedRef.current = resolveInstanceSeed();
  }

  const autoRecoverEnabled = slideConfig.continuous || isInIframe();

  const toggleCaption = useCallback(() => setShowCaption((prev) => !prev), []);
  const togglePause = useCallback(() => setIsPaused((prev) => !prev), []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.ctrlKey && (event.key === "r" || event.key === "R")) {
        event.preventDefault();
        toggleCaption();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleCaption]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSourceMode(getSlideSourceMode(params));
    setAnchor(anchorClean || null);
    setGeneration((prev) => prev + 1);
    setItems([]);
    setIndex(0);
    setShowCaption(false);
  }, [anchorClean]);

  const performSearch = useCallback(
    (imageId: string | null, currentGeneration: number, mode: string) => {
      if (!imageId) {
        setItems([]);
        setError("請在網址加入 ?img=offspring_xxx.png 以決定播放內容。");
        setLoading(false);
        return () => {};
      }

      let cancelled = false;
      let startTimer: ReturnType<typeof setTimeout> | null = null;
      setLoading(true);
      setError(null);

      const run = async () => {
        try {
          const batchSize = Math.max(1, slideConfig.topK ?? DEFAULT_SLIDE_TOP_K);
          if (mode === SlideSourceMode.KINSHIP) {
            const data = await fetchKinshipData(imageId, slideConfig.kinshipDepth);
            if (cancelled || currentGeneration !== generation) return;
            const nextItems = buildKinshipResults(data, imageId, batchSize, slideConfig.kinshipOrder).filter(
              (entry) => !failedSetRef.current.has(entry.cleanId),
            );
            setItems(nextItems);
            setIndex(0);
            retryAttemptRef.current = 0;
          } else {
            const searchPath = `backend/offspring_images/${imageId}`;
            const data = await searchByImage(searchPath, batchSize, { includeDeprecated: slideConfig.includeDeprecated });
            if (cancelled || currentGeneration !== generation) return;
            const fallbackClean = cleanId(imageId) || (imageId ?? "");
            const list = buildVectorResults(data?.results, fallbackClean, batchSize).filter(
              (entry) => !failedSetRef.current.has(entry.cleanId),
            );
            setItems(list.length ? list : [{ id: imageId, cleanId: fallbackClean, distance: null }]);
            setIndex(0);
            retryAttemptRef.current = 0;
          }
          setError(null);
        } catch (err) {
          if (cancelled || currentGeneration !== generation) return;
          const message = err instanceof Error ? err.message : "搜尋失敗，請稍後再試。";
          setError(message);
          if (latestItemsRef.current.length <= 1) {
            const fallbackClean = cleanId(imageId) || (imageId ?? "");
            setItems([{ id: imageId ?? "", cleanId: fallbackClean, distance: null }]);
            setIndex(0);
          }
        } finally {
          if (!cancelled && currentGeneration === generation) {
            setLoading(false);
          }
        }
      };

      const seed = instanceSeedRef.current ?? 0;
      const jitterMs = autoRecoverEnabled ? Math.floor(seed * 1500) : 0;
      if (jitterMs > 0) {
        startTimer = setTimeout(() => {
          if (!cancelled) {
            run();
          }
        }, jitterMs);
      } else {
        run();
      }

      return () => {
        cancelled = true;
        if (startTimer) {
          clearTimeout(startTimer);
        }
      };
    },
    [
      generation,
      fetchKinshipData,
      searchByImage,
      slideConfig.includeDeprecated,
      slideConfig.kinshipDepth,
      slideConfig.kinshipOrder,
      slideConfig.topK,
      autoRecoverEnabled,
    ],
  );

  useEffect(() => {
    if (!anchor) {
      setItems([]);
      return () => {};
    }

    return performSearch(anchor, generation, sourceMode);
  }, [anchor, generation, sourceMode, performSearch]);

  useEffect(() => {
    if (items.length <= 1 || isPaused) return () => {};
    const effectiveInterval = Math.max(1000, intervalMs / playbackSpeed);
    const timer = setInterval(() => {
      setIndex((prev) => {
        const next = prev + 1;
        if (next >= items.length) {
          const last = items[items.length - 1];
          if (last?.cleanId) {
            setAnchor(last.cleanId);
            setGeneration((g) => g + 1);
          }
          return 0;
        }
        return next;
      });
    }, effectiveInterval);
    return () => clearInterval(timer);
  }, [items, intervalMs, playbackSpeed, isPaused]);

  useEffect(() => {
    if (!autoRecoverEnabled) return;
    if (!anchor) return;
    if (isPaused) return;
    if (loading) return;
    if (items.length > 1) return;
    if ((slideConfig.topK ?? DEFAULT_SLIDE_TOP_K) <= 1) return;
    if (!error && failedSetRef.current.size === 0) return;

    const attempt = retryAttemptRef.current;
    const baseDelay = 2000;
    const maxDelay = 30000;
    const delay = Math.min(maxDelay, baseDelay * Math.pow(2, attempt));
    retryAttemptRef.current = Math.min(attempt + 1, 10);

    const seed = instanceSeedRef.current ?? 0;
    const jitterMs = Math.floor(seed * 1200);
    const timer = setTimeout(() => {
      setGeneration((g) => g + 1);
    }, delay + jitterMs);

    return () => clearTimeout(timer);
  }, [autoRecoverEnabled, anchor, isPaused, loading, items.length, slideConfig.topK, error]);

  useEffect(() => {
    latestItemsRef.current = items;
  }, [items]);

  useEffect(() => {
    if (items.length <= 1) return;
    const aheadCount = Math.min(3, items.length - 1);
    for (let step = 1; step <= aheadCount; step += 1) {
      const nextItem = items[(index + step) % items.length];
      if (!nextItem || failedSetRef.current.has(nextItem.cleanId)) continue;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = `${imagesBase}${nextItem.cleanId}`;
    }
  }, [index, items, imagesBase]);

  const handleImageError = useCallback(
    (id?: string) => {
      setItems((prev) => {
        const targetId =
          id || prev[index]?.cleanId || prev[0]?.cleanId || (latestItemsRef.current[0]?.cleanId ?? null);
        if (!targetId) return prev;
        failedSetRef.current.add(targetId);
        const filtered = prev.filter((item) => item.cleanId !== targetId);
        const nextLength = filtered.length;
        setIndex((prevIndex) => {
          if (!nextLength) return 0;
          return prevIndex >= nextLength ? 0 : prevIndex;
        });
        return filtered;
      });
    },
    [index],
  );

  const current = useMemo(() => {
    if (!items.length) return null;
    return items[index % items.length];
  }, [items, index]);

  return {
    items,
    current,
    index,
    loading,
    error,
    showCaption,
    playbackSpeed,
    isPaused,
    setPlaybackSpeed,
    togglePause,
    toggleCaption,
    handleImageError,
  };
}
