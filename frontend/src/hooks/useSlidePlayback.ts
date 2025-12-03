import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { searchImagesByImage, fetchKinship } from "../api";
import {
  BATCH_SIZE,
  DISPLAY_ORDER,
  SlideSourceMode,
  cleanId,
  getSlideSourceMode,
} from "../utils/slideMode";

interface SlideItem {
  id: string;
  cleanId: string;
  distance: number | null;
}

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

const buildVectorResults = (list: unknown, fallbackId: string | null | undefined): SlideItem[] => {
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
  DISPLAY_ORDER.forEach((index) => {
    const entry = prepared[index];
    if (!entry) return;
    orderedByDisplay.push(entry);
  });

  const deduped = deduplicate([...orderedByDisplay, ...prepared]);

  if (fallbackId && !deduped.find((entry) => entry.cleanId === fallbackId)) {
    deduped.unshift({ id: fallbackId, cleanId: fallbackId, distance: null });
  }

  return deduped.slice(0, BATCH_SIZE);
};

const buildKinshipResults = (data: unknown, fallbackId: string | null | undefined): SlideItem[] => {
  const ordered: SlideItem[] = [];
  const pushList = (list: unknown): void => {
    ensureArray<string>(list).forEach((item) => {
      const clean = cleanId(item) || "";
      if (!clean) return;
      ordered.push({ id: clean, cleanId: clean, distance: null });
    });
  };

  const payload = (data || {}) as Record<string, unknown>;
  pushList(payload.children);
  pushList(payload.siblings);
  pushList(payload.parents);
  ensureArray(payload.ancestors_by_level).forEach((level) => pushList(level));
  pushList(payload.ancestors);
  pushList(payload.related_images);

  const list = deduplicate(ordered);
  const original = cleanId((payload.original_image as string) || fallbackId);
  if (original) {
    list.unshift({ id: original, cleanId: original, distance: null });
  }

  const sliced = list.slice(0, BATCH_SIZE);
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
}: {
  anchorImage?: string | null | undefined;
  intervalMs?: number;
  searchByImage?: typeof searchImagesByImage;
  fetchKinshipData?: typeof fetchKinship;
  imagesBase?: string;
} = {}) {
  const anchorClean = cleanId(anchorImage);
  const [items, setItems] = useState<SlideItem[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);
  const [showCaption, setShowCaption] = useState(false);
  const [sourceMode, setSourceMode] = useState(() =>
    getSlideSourceMode(new URLSearchParams(window.location.search)),
  );
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const failedSetRef = useRef<Set<string>>(new Set());
  const latestItemsRef = useRef<SlideItem[]>([]);

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
      setLoading(true);
      setError(null);

      const run = async () => {
        try {
          if (mode === SlideSourceMode.KINSHIP) {
            const data = await fetchKinshipData(imageId, -1);
            if (cancelled || currentGeneration !== generation) return;
            const nextItems = buildKinshipResults(data, imageId).filter(
              (entry) => !failedSetRef.current.has(entry.cleanId),
            );
            setItems(nextItems);
            setIndex(0);
          } else {
            const searchPath = `backend/offspring_images/${imageId}`;
            const data = await searchByImage(searchPath, BATCH_SIZE);
            if (cancelled || currentGeneration !== generation) return;
            const fallbackClean = cleanId(imageId) || (imageId ?? "");
            const list = buildVectorResults(data?.results, fallbackClean).filter(
              (entry) => !failedSetRef.current.has(entry.cleanId),
            );
            setItems(list.length ? list : [{ id: imageId, cleanId: fallbackClean, distance: null }]);
            setIndex(0);
          }
          setError(null);
        } catch (err) {
          if (cancelled || currentGeneration !== generation) return;
          const message = err instanceof Error ? err.message : "搜尋失敗，請稍後再試。";
          setError(message);
          const fallbackClean = cleanId(imageId) || (imageId ?? "");
          setItems([{ id: imageId ?? "", cleanId: fallbackClean, distance: null }]);
          setIndex(0);
        } finally {
          if (!cancelled && currentGeneration === generation) {
            setLoading(false);
          }
        }
      };

      run();

      return () => {
        cancelled = true;
      };
    },
    [generation, fetchKinshipData, searchByImage],
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
