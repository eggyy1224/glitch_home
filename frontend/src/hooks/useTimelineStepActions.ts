import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearCaption,
  clearSubtitle,
  queueSoundPlay,
  sendRemoteClick,
  sendVideoControl,
  setCaption,
  setSubtitle,
  speakWithSubtitle,
  triggerTts,
  unlockAudio,
} from "../api";
import type {
  CaptionAction,
  RemoteClickAction,
  SubtitleAction,
  TimelineStep,
  TtsAction,
  VideoControlAction,
} from "../types/timeline";
import type { AppModeCapabilities } from "../types/mode";

function numberOrUndefined(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function assignIfDefined(target: Record<string, unknown>, key: string, value: unknown) {
  if (value === undefined || value === null) return;
  target[key] = value;
}

interface TimelineStepActionsOptions {
  clientId?: string;
  onError?: (message: string | null) => void;
  capabilities?: Partial<Pick<AppModeCapabilities, "canWriteAssets" | "canAnalyze">> & { forbidMessage?: string };
}

export function useTimelineStepActions({
  clientId,
  onError,
  capabilities = {},
}: TimelineStepActionsOptions = {}) {
  const [actionError, setActionError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const activeRunRef = useRef<number | string | null>(null);
  const actionErrorRef = useRef<string | null>(null);
  const remoteClickTimersRef = useRef<number[]>([]);
  const videoControlTimersRef = useRef<number[]>([]);
  const {
    canWriteAssets = true,
    canAnalyze = true,
    forbidMessage = "",
  } = capabilities || {};

  const clearRemoteClickTimers = useCallback(() => {
    if (!remoteClickTimersRef.current.length) {
      remoteClickTimersRef.current = [];
      return;
    }
    remoteClickTimersRef.current.forEach((timerId) => {
      if (typeof timerId === "number") {
        clearTimeout(timerId);
      }
    });
    remoteClickTimersRef.current = [];
  }, []);

  const cancelPendingActions = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    controllerRef.current = null;
    activeRunRef.current = null;
    clearRemoteClickTimers();
    if (videoControlTimersRef.current.length) {
      videoControlTimersRef.current.forEach((timerId) => {
        if (typeof timerId === "number") {
          clearTimeout(timerId);
        }
      });
      videoControlTimersRef.current = [];
    }
  }, [clearRemoteClickTimers]);

  useEffect(
    () => () => {
      cancelPendingActions();
    },
    [cancelPendingActions],
  );

  const reportActionError = useCallback(
    (message: string) => {
      actionErrorRef.current = message;
      setActionError(message);
      onError?.(message);
    },
    [onError],
  );

  const clearActionError = useCallback(() => {
    if (!actionErrorRef.current) {
      setActionError(null);
      onError?.(null);
      return;
    }
    actionErrorRef.current = null;
    setActionError(null);
    onError?.(null);
  }, [onError]);

  const executeStepActions = useCallback(
    async ({
      step,
      timelineId,
      stepIndex,
      runId,
    }: {
      step: TimelineStep;
      timelineId?: string | null;
      stepIndex?: number;
      runId: number | string;
    }) => {
      if (!step || runId == null) return;
      cancelPendingActions();
      const controller = new AbortController();
      controllerRef.current = controller;
      activeRunRef.current = runId;
      const { signal } = controller;

      const isStale = () => signal.aborted || activeRunRef.current !== runId;

      const actionsRan: string[] = [];
      const errors: string[] = [];
      let hasErrors = false;

      const handleError = (label: string, err: unknown) => {
        const isAbort = err instanceof Error && err.name === "AbortError";
        if (isAbort || isStale()) {
          return;
        }
        const errorMessage =
          err instanceof Error
            ? err.message
            : err && typeof err === "object" && "message" in err
              ? String((err as { message?: unknown }).message)
              : null;
        const message = `[${label}] ${errorMessage || String(err)}`;
        errors.push(message);
        hasErrors = true;
        console.error("Timeline step action failed:", label, err);
      };

      const flushErrors = () => {
        if (!errors.length) {
          return;
        }
        const prefix = timelineId ? `Timeline ${timelineId}` : "Timeline";
        const indexLabel = typeof stepIndex === "number" ? ` step ${stepIndex + 1}` : "";
        const summary = `${prefix}${indexLabel}: ${errors.join(" | ")}`;
        errors.length = 0;
        reportActionError(summary);
      };

      const resolveTarget = (actionTarget?: string | null) => actionTarget || step.client_id || (clientId ?? null);

      const remoteClicks: RemoteClickAction[] = Array.isArray(step.remote_clicks)
        ? step.remote_clicks
        : Array.isArray(step.remoteClicks)
          ? step.remoteClicks
          : [];
      const hasRemoteClicks = remoteClicks.length > 0;

      const videoControls: VideoControlAction[] = Array.isArray(step.video_controls)
        ? step.video_controls
        : Array.isArray(step.videoControls)
          ? step.videoControls
          : [];
      const hasVideoControls = videoControls.length > 0;

      const unlockAudioTargets = Array.isArray(step.unlock_audio_targets)
        ? step.unlock_audio_targets
        : Array.isArray(step.unlockAudioTargets)
          ? step.unlockAudioTargets
          : [];

      const scheduleRemoteClick = (action: RemoteClickAction | null | undefined, index: number) => {
        if (!action) return;
        const actionLabel =
          (typeof action.label === "string" && action.label.trim()) || `remote_${index + 1}`;
        const getSelector = (value: unknown) => (typeof value === "string" ? value.trim() : "");
        const buildPayload = () => {
          const payload: Record<string, unknown> = {};
          const selector = getSelector(action.selector);
          if (selector) {
            payload.selector = selector;
          }
          const nested = getSelector(action.target ?? action.target_selector);
          if (nested) {
            payload.target = nested;
          }
          const xValue = numberOrUndefined(action.x);
          const yValue = numberOrUndefined(action.y);
          if (xValue !== undefined) {
            payload.x = xValue;
          }
          if (yValue !== undefined) {
            payload.y = yValue;
          }
          const targetOverride = resolveTarget(action.target_client_id || action.targetClientId);
          if (targetOverride) {
            payload.target_client_id = targetOverride;
          }
          const hasSelector = Boolean(payload.selector);
          const hasTarget = Boolean(payload.target);
          const hasCoordinates = payload.x !== undefined && payload.y !== undefined;
          if (!hasSelector && !hasTarget && !hasCoordinates) {
            throw new Error("remote_click 需要 selector/target 或 x,y 座標");
          }
          return payload;
        };

        const executeRemoteClick = async () => {
          if (isStale()) return;
          try {
            const payload = buildPayload();
            await sendRemoteClick(payload, { signal });
          } catch (err) {
            handleError(`remote_click:${actionLabel}`, err);
            flushErrors();
          }
        };

        const delaySeconds = numberOrUndefined(action.offset_seconds ?? action.offsetSeconds) || 0;
        const delayMs = delaySeconds > 0 ? delaySeconds * 1000 : 0;
        if (delayMs <= 0) {
          void executeRemoteClick();
          return;
        }
        const timerId = window.setTimeout(() => {
          remoteClickTimersRef.current = remoteClickTimersRef.current.filter((id) => id !== timerId);
          void executeRemoteClick();
        }, delayMs);
        remoteClickTimersRef.current.push(timerId);
      };

      const scheduleVideoControl = (action: VideoControlAction | null | undefined, index: number) => {
        if (!action || !action.action) return;
        const labelBase = typeof action.action === "string" ? action.action : "video";
        const actionLabel = `${labelBase}_${index + 1}`;
        const buildPayload = () => {
          const payload: Record<string, unknown> = { action: action.action };
          const volumeValue = numberOrUndefined(action.volume);
          if (volumeValue !== undefined) {
            payload.volume = Math.min(1, Math.max(0, volumeValue));
          }
          const speedValue = numberOrUndefined(action.speed);
          if (speedValue !== undefined) {
            payload.speed = Math.max(0.25, Math.min(4, speedValue));
          }
          if (typeof action.muted === "boolean") {
            payload.muted = action.muted;
          }
          const timeValue = numberOrUndefined(action.time);
          if (timeValue !== undefined) {
            payload.time = Math.max(0, timeValue);
          }
          const targetOverride = resolveTarget(action.target_client_id || action.targetClientId);
          if (targetOverride) {
            payload.target_client_id = targetOverride;
          }
          return payload;
        };

        const executeVideoControl = async () => {
          if (isStale()) return;
          try {
            const payload = buildPayload();
            await sendVideoControl(payload, { signal });
          } catch (err) {
            handleError(`video_control:${actionLabel}`, err);
            flushErrors();
          }
        };

        const delaySeconds = numberOrUndefined(action.offset_seconds ?? action.offsetSeconds) || 0;
        const delayMs = delaySeconds > 0 ? delaySeconds * 1000 : 0;
        if (delayMs <= 0) {
          void executeVideoControl();
          return;
        }
        const timerId = window.setTimeout(() => {
          videoControlTimersRef.current = videoControlTimersRef.current.filter((id) => id !== timerId);
          void executeVideoControl();
        }, delayMs);
        videoControlTimersRef.current.push(timerId);
      };

      const runUnlockAudio = async () => {
        if (!unlockAudioTargets.length || isStale()) return;
        for (const target of unlockAudioTargets) {
          if (isStale()) return;
          const trimmed = typeof target === "string" ? target.trim() : "";
          try {
            await unlockAudio(trimmed || null, { signal });
          } catch (err) {
            handleError(`unlock_audio${trimmed ? `:${trimmed}` : ""}`, err);
            flushErrors();
          }
        }
      };

      const runTimedText = async (action: SubtitleAction | CaptionAction | null | undefined, kind: "subtitle" | "caption") => {
        if (!action || isStale()) return;
        const target = resolveTarget(action.target_client_id);
        if (action.clear) {
          if (kind === "subtitle") {
            await clearSubtitle(target, { signal });
          } else {
            await clearCaption(target, { signal });
          }
          return;
        }
        const payload: Record<string, unknown> = { text: action.text };
        assignIfDefined(payload, "language", action.language);
        const duration = numberOrUndefined(action.duration_seconds);
        if (duration !== undefined) {
          payload.duration_seconds = duration;
        }
        if (isStale()) return;
        if (kind === "subtitle") {
          await setSubtitle(payload, target, { signal });
        } else {
          await setCaption(payload, target, { signal });
        }
      };

      const runSpeech = async (action: TtsAction | null | undefined) => {
        if (!action || isStale()) return;
        const target = resolveTarget(action.target_client_id);
        if (action.mode === "sound_play") {
          if (!action.sound_filename) {
            throw new Error("sound_play 需要 sound_filename");
          }
          await queueSoundPlay(action.sound_filename, target, { signal });
          return;
        }
        if (!canWriteAssets) {
          throw new Error(forbidMessage || "目前模式禁止生成/寫入音訊");
        }
        if (!canAnalyze) {
          throw new Error(forbidMessage || "目前模式禁止語音生成/分析");
        }
        const base: Record<string, unknown> = {
          text: action.text,
        };
        assignIfDefined(base, "instructions", action.instructions);
        assignIfDefined(base, "voice", action.voice);
        assignIfDefined(base, "model", action.model);
        assignIfDefined(base, "output_format", action.output_format);
        assignIfDefined(base, "filename_base", action.filename_base);
        const speed = numberOrUndefined(action.speed);
        if (speed !== undefined) {
          base.speed = speed;
        }
        if (typeof action.auto_play === "boolean") {
          base.auto_play = action.auto_play;
        }
        if (target) {
          base.target_client_id = target;
        }

        if (action.mode === "speak_with_subtitle") {
          const payload: Record<string, unknown> = { ...base };
          assignIfDefined(payload, "subtitle_text", action.subtitle_text || action.text);
          assignIfDefined(payload, "subtitle_language", action.subtitle_language);
          const subtitleDuration = numberOrUndefined(action.subtitle_duration_seconds);
          if (subtitleDuration !== undefined) {
            payload.subtitle_duration_seconds = subtitleDuration;
          }
          if (isStale()) return;
          await speakWithSubtitle(payload, { signal });
        } else {
          if (isStale()) return;
          await triggerTts(base, { signal });
        }
      };

      try {
        await runUnlockAudio();
      } catch (err) {
        handleError("unlock_audio", err);
      }

      try {
        if (step.subtitle) {
          await runTimedText(step.subtitle, "subtitle");
          actionsRan.push("subtitle");
        }
      } catch (err) {
        handleError("subtitle", err);
      }

      try {
        if (step.caption) {
          await runTimedText(step.caption, "caption");
          actionsRan.push("caption");
        }
      } catch (err) {
        handleError("caption", err);
      }

      try {
        if (step.tts) {
          await runSpeech(step.tts);
          actionsRan.push(step.tts.mode || "tts");
        }
      } catch (err) {
        handleError("tts", err);
      }

      try {
        if (remoteClicks.length) {
          remoteClicks.forEach((action, index) => scheduleRemoteClick(action, index));
        }
      } catch (err) {
        handleError("remote_click", err);
        flushErrors();
      }

      try {
        if (videoControls.length) {
          videoControls.forEach((action, index) => scheduleVideoControl(action, index));
        }
      } catch (err) {
        handleError("video_control", err);
        flushErrors();
      }

      if (isStale()) {
        return;
      }

      if (hasErrors) {
        flushErrors();
      } else if (actionsRan.length > 0 || hasRemoteClicks || hasVideoControls || actionErrorRef.current) {
        clearActionError();
      }
    },
    [clientId, cancelPendingActions, clearActionError, reportActionError, canWriteAssets, canAnalyze, forbidMessage],
  );

  return {
    executeStepActions,
    actionError,
    clearActionError,
    cancelPendingActions,
  };
}
