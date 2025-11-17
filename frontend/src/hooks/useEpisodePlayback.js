import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchEpisode } from "../api.js";

function resolveTimelineId(episode) {
  if (!episode) return null;
  if (episode.timeline?.id) return episode.timeline.id;
  if (episode.timelineId) return episode.timelineId;
  if (episode.timeline_id) return episode.timeline_id;
  return null;
}

export function useEpisodePlayback({ episodeId, fallbackTimelineId = null } = {}) {
  const [episode, setEpisode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!episodeId) {
      setEpisode(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetchEpisode(episodeId, { signal: controller.signal })
      .then((data) => {
        if (cancelled) return;
        setEpisode(data?.episode || null);
      })
      .catch((err) => {
        if (cancelled) return;
        setEpisode(null);
        setError(err.message || "載入 Episode 失敗");
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
  }, [episodeId, reloadKey]);

  const timelineId = useMemo(() => {
    const fromEpisode = resolveTimelineId(episode);
    if (fromEpisode) return fromEpisode;
    return fallbackTimelineId || null;
  }, [episode, fallbackTimelineId]);

  const reloadEpisode = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  return {
    episode,
    timelineId,
    loading,
    error,
    reloadEpisode,
    hasEpisodeSelected: Boolean(episodeId),
  };
}
