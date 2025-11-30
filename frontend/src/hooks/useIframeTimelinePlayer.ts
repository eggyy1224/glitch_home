import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchIframeTimeline } from "../api";
import type { IframeTimelineResolved, TimelineStepWithConfig } from "../types/control";

const clampIndex = (index: number, max: number) => {
  if (max <= 0) return 0;
  if (index < 0) return 0;
  if (index > max) return max;
  return index;
};

interface UseIframeTimelinePlayerOptions {
  timelineId: string | null;
  isActive: boolean;
  applyRemoteConfig?: (config: unknown) => void;
  releaseRemoteConfig?: () => void;
  onStepStart?: (payload: { step: TimelineStepWithConfig; stepIndex: number; runId: number }) => void;
  initialStep?: number | null;
  autoPlayOnLoad?: boolean;
  loopOverride?: boolean | null;
  sessionKey?: string | null;
}

export function useIframeTimelinePlayer({
  timelineId,
  isActive,
  applyRemoteConfig,
  releaseRemoteConfig,
  onStepStart,
  initialStep = null,
  autoPlayOnLoad = true,
  loopOverride = null,
  sessionKey = null,
}: UseIframeTimelinePlayerOptions) {
  const [timeline, setTimeline] = useState<IframeTimelineResolved | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const timerRef = useRef<number | null>(null);
  const runIdRef = useRef(0);

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
      runIdRef.current = 0;
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
    runIdRef.current = 0;

    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchIframeTimeline(timelineId, { signal: controller.signal })
      .then((data) => {
        if (cancelled) return;
        const payload = (data as { timeline?: IframeTimelineResolved }).timeline ?? data;
        let resolvedTimeline = payload as IframeTimelineResolved | null;
        if (payload && loopOverride !== null && loopOverride !== undefined) {
          resolvedTimeline = { ...(payload as IframeTimelineResolved), loop: loopOverride };
        }
        setTimeline(resolvedTimeline);
        const steps = Array.isArray(resolvedTimeline?.steps) ? (resolvedTimeline?.steps as TimelineStepWithConfig[]) : [];
        const hasSteps = steps.length > 0;
        const nextIndex =
          initialStep !== null && initialStep !== undefined
            ? clampIndex(initialStep, steps.length > 0 ? steps.length - 1 : 0)
            : 0;
        setCurrentStepIndex(nextIndex);
        runIdRef.current = 0;
        setIsPlaying(hasSteps && autoPlayOnLoad);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "載入 timeline 失敗";
        setError(message);
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
  }, [timelineId, isActive, reloadKey, stopTimer, loopOverride, sessionKey, initialStep, autoPlayOnLoad]);

  useEffect(() => {
    if (!isActive) {
      stopTimer();
      if (timelineId) {
        setIsPlaying(false);
        releaseRemoteConfig?.();
      }
      runIdRef.current = 0;
      return;
    }
  }, [isActive, releaseRemoteConfig, stopTimer, timelineId]);

  const applyStepConfig = useCallback(
    (step: TimelineStepWithConfig | null) => {
      if (!step?.config) return;
      applyRemoteConfig?.(step.config);
    },
    [applyRemoteConfig],
  );

  useEffect(() => {
    if (!timeline || !isActive || !isPlaying) {
      return undefined;
    }
    const steps = Array.isArray(timeline.steps) ? (timeline.steps as TimelineStepWithConfig[]) : [];
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
    const runId = (runIdRef.current += 1);
    onStepStart?.({ step, stepIndex: index, runId });
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
  }, [timeline, isActive, isPlaying, currentStepIndex, applyStepConfig, releaseRemoteConfig, stopTimer, onStepStart]);

  useEffect(() => {
    if (!isPlaying) {
      stopTimer();
    }
  }, [isPlaying, stopTimer]);

  const jumpToStep = useCallback(
    (nextIndex: number, { autoplay = false }: { autoplay?: boolean } = {}) => {
      if (!timeline || !Array.isArray(timeline.steps) || !timeline.steps.length) return;
      const bounded = clampIndex(nextIndex, timeline.steps.length - 1);
      setCurrentStepIndex(bounded);
      if (!isPlaying) {
        const step = timeline.steps[bounded] as TimelineStepWithConfig;
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
    runIdRef.current = 0;
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
    return (timeline.steps[clampIndex(currentStepIndex, timeline.steps.length - 1)] as TimelineStepWithConfig) || null;
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
  } as const;
}
