import { useCallback, useEffect, useMemo, useState } from "react";
import { searchImagesByImage, fetchKinship } from "../api.js";
import {
  BATCH_SIZE,
  DISPLAY_ORDER,
  SlideSourceMode,
  cleanId,
  getSlideSourceMode,
} from "../utils/slideMode.js";

const ensureArray = (value) => (Array.isArray(value) ? value : []);

const deduplicate = (entries) => {
  const seen = new Set();
  const ordered = [];
  entries.forEach((entry) => {
    if (!entry?.cleanId || seen.has(entry.cleanId)) {
      return;
    }
    ordered.push(entry);
    seen.add(entry.cleanId);
  });
  return ordered;
};

const buildVectorResults = (list, fallbackId) => {
  const prepared = ensureArray(list)
    .map((item) => ({
      id: item?.id || "",
      cleanId: cleanId(item?.id || ""),
      distance: typeof item?.distance === "number" ? item.distance : null,
    }))
    .filter((entry) => entry.cleanId);

  const orderedByDisplay = [];
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

const buildKinshipResults = (data, fallbackId) => {
  const ordered = [];
  const pushList = (list) => {
    ensureArray(list).forEach((item) => {
      const clean = cleanId(item);
      if (!clean) return;
      ordered.push({ id: clean, cleanId: clean, distance: null });
    });
  };

  pushList(data?.children);
  pushList(data?.siblings);
  pushList(data?.parents);
  ensureArray(data?.ancestors_by_level).forEach((level) => pushList(level));
  pushList(data?.ancestors);
  pushList(data?.related_images);

  const list = deduplicate(ordered);
  const original = cleanId(data?.original_image || fallbackId);
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
} = {}) {
  const anchorClean = cleanId(anchorImage);
  const [items, setItems] = useState([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [anchor, setAnchor] = useState(null);
  const [generation, setGeneration] = useState(0);
  const [showCaption, setShowCaption] = useState(false);
  const [sourceMode, setSourceMode] = useState(() =>
    getSlideSourceMode(new URLSearchParams(window.location.search)),
  );
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isPaused, setIsPaused] = useState(false);

  const toggleCaption = useCallback(() => setShowCaption((prev) => !prev), []);
  const togglePause = useCallback(() => setIsPaused((prev) => !prev), []);

  useEffect(() => {
    const handler = (event) => {
      if (event.ctrlKey && (event.key === "r" || event.key === "R")) {
        event.preventDefault();
        toggleCaption();
      }
    };
    window.addEventListener("keydown", handler, { passive: false });
    return () => window.removeEventListener("keydown", handler, { passive: false });
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
    (imageId, currentGeneration, mode) => {
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
            setItems(buildKinshipResults(data, imageId));
            setIndex(0);
          } else {
            const searchPath = `backend/offspring_images/${imageId}`;
            const data = await searchByImage(searchPath, BATCH_SIZE);
            if (cancelled || currentGeneration !== generation) return;
            const list = buildVectorResults(data?.results, cleanId(imageId));
            setItems(list.length ? list : [{ id: imageId, cleanId: cleanId(imageId), distance: null }]);
            setIndex(0);
          }
          setError(null);
        } catch (err) {
          if (cancelled || currentGeneration !== generation) return;
          setError(err?.message || "搜尋失敗，請稍後再試。");
          setItems([{ id: imageId, cleanId: cleanId(imageId), distance: null }]);
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
  };
}
