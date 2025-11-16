import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchIframeTimeline } from "../api.js";

const clampIndex = (index, max) => {
  if (max <= 0) return 0;
  if (index < 0) return 0;
  if (index > max) return max;
  return index;
};

export function useIframeTimelinePlayer({
  timelineId,
  isActive,
  applyRemoteConfig,
  releaseRemoteConfig,
}) {
  const [timeline, setTimeline] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const timerRef = useRef(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopTimer();
    };
  }, [stopTimer]);

  useEffect(() => {
    if (!timelineId) {
      stopTimer();
      setTimeline(null);
      setIsPlaying(false);
      setCurrentStepIndex(0);
      setError(null);
      releaseRemoteConfig?.();
      return;
    }
  }, [timelineId, stopTimer, releaseRemoteConfig]);

  useEffect(() => {
    if (!timelineId || !isActive) {
      return undefined;
    }

    stopTimer();
    setTimeline(null);
    setIsPlaying(false);
    setCurrentStepIndex(0);

    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchIframeTimeline(timelineId, { signal: controller.signal })
      .then((data) => {
        if (cancelled) return;
        const payload = data?.timeline || null;
        setTimeline(payload);
        setCurrentStepIndex(0);
        setIsPlaying(Boolean(payload && Array.isArray(payload.steps) && payload.steps.length));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || "載入 timeline 失敗");
        setTimeline(null);
        setIsPlaying(false);
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
  }, [timelineId, isActive, reloadKey, stopTimer]);

  useEffect(() => {
    if (!isActive) {
      stopTimer();
      if (timelineId) {
        setIsPlaying(false);
        releaseRemoteConfig?.();
      }
      return;
    }
  }, [isActive, releaseRemoteConfig, stopTimer, timelineId]);

  const applyStepConfig = useCallback(
    (step) => {
      if (!step?.config) return;
      applyRemoteConfig?.(step.config);
    },
    [applyRemoteConfig],
  );

  useEffect(() => {
    if (!timeline || !isActive || !isPlaying) {
      return undefined;
    }
    const steps = Array.isArray(timeline.steps) ? timeline.steps : [];
    if (!steps.length) {
      setIsPlaying(false);
      return undefined;
    }
    const index = clampIndex(currentStepIndex, steps.length - 1);
    const step = steps[index];
    if (!step) {
      return undefined;
    }
    stopTimer();
    applyStepConfig(step);
    const durationMs = Math.max(0.1, Number(step.duration) || 0) * 1000;
    const timer = window.setTimeout(() => {
      setCurrentStepIndex((prev) => {
        const next = prev + 1;
        if (next < steps.length) {
          return next;
        }
        if (timeline.loop) {
          return 0;
        }
        setIsPlaying(false);
        releaseRemoteConfig?.();
        return 0;
      });
    }, durationMs);
    timerRef.current = timer;
    return () => {
      clearTimeout(timer);
    };
  }, [timeline, isActive, isPlaying, currentStepIndex, applyStepConfig, releaseRemoteConfig, stopTimer]);

  useEffect(() => {
    if (!isPlaying) {
      stopTimer();
    }
  }, [isPlaying, stopTimer]);

  const jumpToStep = useCallback(
    (nextIndex, { autoplay = false } = {}) => {
      if (!timeline || !Array.isArray(timeline.steps) || !timeline.steps.length) return;
      const bounded = clampIndex(nextIndex, timeline.steps.length - 1);
      setCurrentStepIndex(bounded);
      if (!isPlaying) {
        const step = timeline.steps[bounded];
        applyStepConfig(step);
      }
      if (autoplay) {
        setIsPlaying(true);
      }
    },
    [timeline, isPlaying, applyStepConfig],
  );

  const play = useCallback(() => {
    if (!timeline || !Array.isArray(timeline.steps) || !timeline.steps.length) return;
    setIsPlaying(true);
  }, [timeline]);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const stop = useCallback(() => {
    setIsPlaying(false);
    setCurrentStepIndex(0);
    stopTimer();
    releaseRemoteConfig?.();
  }, [releaseRemoteConfig, stopTimer]);

  const next = useCallback(() => {
    jumpToStep(currentStepIndex + 1, { autoplay: false });
  }, [jumpToStep, currentStepIndex]);

  const previous = useCallback(() => {
    jumpToStep(currentStepIndex - 1, { autoplay: false });
  }, [jumpToStep, currentStepIndex]);

  const reload = useCallback(() => {
    if (!timelineId) return;
    setReloadKey((key) => key + 1);
  }, [timelineId]);

  const currentStep = useMemo(() => {
    if (!timeline || !Array.isArray(timeline.steps)) return null;
    return timeline.steps[clampIndex(currentStepIndex, timeline.steps.length - 1)] || null;
  }, [timeline, currentStepIndex]);

  const status = useMemo(() => {
    if (!timelineId) return "idle";
    if (loading) return "loading";
    if (error) return "error";
    if (isPlaying) return "playing";
    return "paused";
  }, [timelineId, loading, error, isPlaying]);

  return {
    timeline,
    currentStep,
    currentStepIndex,
    isPlaying,
    status,
    loading,
    error,
    play,
    pause,
    stop,
    next,
    previous,
    jumpToStep,
    reload,
  };
}
