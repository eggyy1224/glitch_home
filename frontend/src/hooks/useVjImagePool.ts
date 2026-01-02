import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchKinship, searchImagesByImage } from "../api";
import { DEFAULT_KINSHIP_DEPTH, DEFAULT_KINSHIP_ORDER, DEFAULT_SLIDE_TOP_K, SlideSourceMode, cleanId } from "../utils/slideMode";

type SlideItem = {
  id: string;
  cleanId: string;
  distance: number | null;
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

const buildVectorResults = (data: unknown, fallbackId: string, limit: number): SlideItem[] => {
  const results = ensureArray<{ id?: string; distance?: number }>((data as { results?: unknown })?.results)
    .map((item) => {
      const cleaned = cleanId(item?.id || "") || "";
      return {
        id: item?.id || "",
        cleanId: cleaned,
        distance: typeof item?.distance === "number" ? item.distance : null,
      };
    })
    .filter((entry) => entry.cleanId);

  const deduped = deduplicate(results);
  if (!deduped.find((entry) => entry.cleanId === fallbackId)) {
    deduped.unshift({ id: fallbackId, cleanId: fallbackId, distance: null });
  }
  return deduped.slice(0, limit);
};

const buildKinshipResults = (data: unknown, fallbackId: string, limit: number, order = DEFAULT_KINSHIP_ORDER): SlideItem[] => {
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
  if (!list.find((entry) => entry.cleanId === fallbackId)) {
    list.unshift({ id: fallbackId, cleanId: fallbackId, distance: null });
  }
  return list.slice(0, limit);
};

export type VjPoolOptions = {
  anchorImage: string | null;
  topK?: number;
  slideSource?: (typeof SlideSourceMode)[keyof typeof SlideSourceMode];
  kinshipDepth?: number | null;
  kinshipOrder?: typeof DEFAULT_KINSHIP_ORDER;
  includeDeprecated?: boolean;
};

export function useVjImagePool({
  anchorImage,
  topK = DEFAULT_SLIDE_TOP_K,
  slideSource = SlideSourceMode.VECTOR,
  kinshipDepth = DEFAULT_KINSHIP_DEPTH,
  kinshipOrder = DEFAULT_KINSHIP_ORDER,
  includeDeprecated = false,
}: VjPoolOptions) {
  const [anchor, setAnchor] = useState<string | null>(() => cleanId(anchorImage) || null);
  const [items, setItems] = useState<SlideItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const failedSetRef = useRef<Set<string>>(new Set());
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const nextAnchor = cleanId(anchorImage) || null;
    setAnchor((prev) => (prev === nextAnchor ? prev : nextAnchor));
  }, [anchorImage]);

  const markFailed = useCallback((imageId: string) => {
    const cleaned = cleanId(imageId);
    if (!cleaned) return;
    failedSetRef.current.add(cleaned);
  }, []);

  const clearFailed = useCallback(() => {
    failedSetRef.current.clear();
  }, []);

  const refresh = useCallback(() => {
    setReloadKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!anchor) {
      setItems([]);
      setError("請在網址加入 ?img=檔名 以決定播放內容。");
      setLoading(false);
      return () => {};
    }

    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    const controller = new AbortController();
    controllerRef.current = controller;

    const safeTopK = Math.max(1, Math.floor(topK));
    setLoading(true);
    setError(null);

    const run = async () => {
      try {
        if (slideSource === SlideSourceMode.KINSHIP) {
          const depth = kinshipDepth == null ? DEFAULT_KINSHIP_DEPTH : Math.floor(kinshipDepth);
          const data = await fetchKinship(anchor, depth, { signal: controller.signal });
          const nextItems = buildKinshipResults(data, anchor, safeTopK, kinshipOrder).filter(
            (entry) => !failedSetRef.current.has(entry.cleanId),
          );
          if (nextItems.length) {
            setItems(nextItems);
            return;
          }
          if (failedSetRef.current.has(anchor)) {
            setItems([]);
            setError("找不到可用圖片（anchor 已失敗且無替代結果）。");
            return;
          }
          setItems([{ id: anchor, cleanId: anchor, distance: null }]);
          return;
        }

        const searchPath = `backend/offspring_images/${anchor}`;
        const data = await searchImagesByImage(searchPath, safeTopK, { signal: controller.signal, includeDeprecated });
        const nextItems = buildVectorResults(data, anchor, safeTopK).filter((entry) => !failedSetRef.current.has(entry.cleanId));
        if (nextItems.length) {
          setItems(nextItems);
          return;
        }
        if (failedSetRef.current.has(anchor)) {
          setItems([]);
          setError("找不到可用圖片（anchor 已失敗且無替代結果）。");
          return;
        }
        setItems([{ id: anchor, cleanId: anchor, distance: null }]);
      } catch (err) {
        if ((err as { name?: unknown })?.name === "AbortError") {
          return;
        }
        const message = err instanceof Error ? err.message : "載入播放清單失敗";
        setError(message);
        if (failedSetRef.current.has(anchor)) {
          setItems([]);
        } else {
          setItems([{ id: anchor, cleanId: anchor, distance: null }]);
        }
      } finally {
        setLoading(false);
      }
    };

    void run();

    return () => {
      controller.abort();
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    };
  }, [anchor, topK, slideSource, kinshipDepth, kinshipOrder, includeDeprecated, reloadKey]);

  const currentAnchor = anchor;
  const setAnchorClean = useCallback((next: string | null) => {
    const cleaned = next ? cleanId(next) : null;
    setAnchor(cleaned || null);
  }, []);

  const pool = useMemo(() => {
    return {
      anchor: currentAnchor,
      items,
      loading,
      error,
      setAnchor: setAnchorClean,
      markFailed,
      clearFailed,
      refresh,
    };
  }, [currentAnchor, items, loading, error, setAnchorClean, markFailed, clearFailed, refresh]);

  return pool;
}
