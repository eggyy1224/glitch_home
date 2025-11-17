import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchEpisodes } from "../api.js";

export function useEpisodes({ clientId, initialEpisodeId = null, autoSelectFirst = false } = {}) {
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState(initialEpisodeId || null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!initialEpisodeId) return;
    setSelectedEpisodeId(initialEpisodeId);
  }, [initialEpisodeId]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetchEpisodes({ clientId, signal: controller.signal })
      .then((list) => {
        if (cancelled) return;
        setEpisodes(list);
      })
      .catch((err) => {
        if (cancelled) return;
        setEpisodes([]);
        setError(err.message || "載入 Episode 列表失敗");
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [clientId, reloadKey]);

  useEffect(() => {
    if (!autoSelectFirst) return;
    if (selectedEpisodeId) return;
    if (!episodes.length) return;
    setSelectedEpisodeId(episodes[0].id);
  }, [autoSelectFirst, episodes, selectedEpisodeId]);

  const selectEpisode = useCallback((nextId) => {
    setSelectedEpisodeId(nextId || null);
  }, []);

  const refreshEpisodes = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  const metadata = useMemo(
    () => ({
      hasEpisodes: episodes.length > 0,
    }),
    [episodes.length],
  );

  return {
    episodes,
    loading,
    error,
    selectedEpisodeId,
    selectEpisode,
    refreshEpisodes,
    ...metadata,
  };
}
