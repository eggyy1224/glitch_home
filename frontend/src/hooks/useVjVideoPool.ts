import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchVideoAssets, type VideoAssetEntry } from "../api/media";

type VjVideoPoolOptions = {
  preferredVideo?: string | null;
  shuffle?: boolean;
  videoBase?: string | null;
};

type VjVideoPoolState = {
  videos: VideoAssetEntry[];
  current: VideoAssetEntry | null;
  loading: boolean;
  error: string | null;
  setVideoByName: (name: string | null) => void;
  pickNext: () => void;
  markFailed: (name: string) => void;
};

const normalizeName = (value: string | null | undefined) => (value ? value.trim() : "");

const buildFallbackEntry = (name: string, videoBase?: string | null): VideoAssetEntry | null => {
  const trimmed = normalizeName(name);
  if (!trimmed) return null;
  if (!videoBase) return null;
  const base = videoBase.endsWith("/") ? videoBase : `${videoBase}/`;
  return { filename: trimmed, url: `${base}${trimmed}` };
};

const pickRandom = (list: VideoAssetEntry[], exclude?: string, failed?: Set<string>) => {
  const candidates = list.filter((entry) => {
    if (failed?.has(entry.filename)) return false;
    if (exclude && entry.filename === exclude) return false;
    return true;
  });
  if (!candidates.length) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
};

export function useVjVideoPool({ preferredVideo, shuffle = true, videoBase = null }: VjVideoPoolOptions): VjVideoPoolState {
  const [videos, setVideos] = useState<VideoAssetEntry[]>([]);
  const [current, setCurrent] = useState<VideoAssetEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const failedSetRef = useRef<Set<string>>(new Set());

  const resolveVideo = useCallback(
    (name: string | null | undefined) => {
      const trimmed = normalizeName(name);
      if (!trimmed) return null;
      const match = videos.find((entry) => entry.filename === trimmed);
      if (match) return match;
      return buildFallbackEntry(trimmed, videoBase);
    },
    [videos, videoBase],
  );

  const setVideoByName = useCallback(
    (name: string | null) => {
      if (!name) return;
      const resolved = resolveVideo(name);
      if (resolved) {
        setCurrent(resolved);
      }
    },
    [resolveVideo],
  );

  const pickNext = useCallback(() => {
    if (!videos.length) {
      setCurrent(null);
      return null;
    }
    if (!shuffle) {
      const next = videos.find((entry) => !failedSetRef.current.has(entry.filename)) || videos[0] || null;
      setCurrent((prev) => {
        if (prev && !failedSetRef.current.has(prev.filename)) return prev;
        return next;
      });
      return next;
    }
    const next = pickRandom(videos, current?.filename, failedSetRef.current);
    setCurrent(next || null);
    return next;
  }, [videos, shuffle, current?.filename]);

  const markFailed = useCallback(
    (name: string) => {
      const trimmed = normalizeName(name);
      if (!trimmed) return;
      failedSetRef.current.add(trimmed);
      if (current?.filename === trimmed) {
        pickNext();
      }
    },
    [current?.filename, pickNext],
  );

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const { videos: list } = await fetchVideoAssets();
        if (!active) return;
        const safeList = Array.isArray(list) ? list : [];
        setVideos(safeList);
        if (preferredVideo) {
          const resolved = safeList.find((entry) => entry.filename === preferredVideo) || buildFallbackEntry(preferredVideo, videoBase);
          setCurrent(resolved || safeList[0] || null);
          return;
        }
        if (shuffle) {
          const next = pickRandom(safeList, "", failedSetRef.current);
          setCurrent(next || safeList[0] || null);
        } else {
          setCurrent(safeList[0] || null);
        }
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "載入影片清單失敗");
        const fallback = preferredVideo ? buildFallbackEntry(preferredVideo, videoBase) : null;
        setCurrent(fallback);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [preferredVideo, shuffle, videoBase]);

  useEffect(() => {
    if (preferredVideo) {
      setVideoByName(preferredVideo);
    }
  }, [preferredVideo, setVideoByName]);

  return useMemo(
    () => ({
      videos,
      current,
      loading,
      error,
      setVideoByName,
      pickNext,
      markFailed,
    }),
    [videos, current, loading, error, setVideoByName, pickNext, markFailed],
  );
}
