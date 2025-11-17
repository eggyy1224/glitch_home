import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearCaption,
  clearSubtitle,
  queueSoundPlay,
  sendRemoteClick,
  setCaption,
  setSubtitle,
  speakWithSubtitle,
  triggerTts,
} from "../api.js";

function numberOrUndefined(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function assignIfDefined(target, key, value) {
  if (value === undefined || value === null) return;
  target[key] = value;
}

export function useTimelineStepActions({ clientId, onError } = {}) {
  const [actionError, setActionError] = useState(null);
  const controllerRef = useRef(null);
  const activeRunRef = useRef(null);
  const actionErrorRef = useRef(null);
  const remoteClickTimersRef = useRef([]);

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
  }, [clearRemoteClickTimers]);

  useEffect(
    () => () => {
      cancelPendingActions();
    },
    [cancelPendingActions],
  );

  const reportActionError = useCallback(
    (message) => {
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
    async ({ step, timelineId, stepIndex, runId }) => {
      if (!step || runId == null) return;
      cancelPendingActions();
      const controller = new AbortController();
      controllerRef.current = controller;
      activeRunRef.current = runId;
      const { signal } = controller;

      const isStale = () => signal.aborted || activeRunRef.current !== runId;

      const actionsRan = [];
      const errors = [];
      let hasErrors = false;

      const handleError = (label, err) => {
        if (err?.name === "AbortError" || isStale()) {
          return;
        }
        const message = `[${label}] ${err?.message || String(err)}`;
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

      const resolveTarget = (actionTarget) => actionTarget || step.client_id || clientId || null;

      const remoteClicks = Array.isArray(step.remote_clicks)
        ? step.remote_clicks
        : Array.isArray(step.remoteClicks)
          ? step.remoteClicks
          : [];
      const hasRemoteClicks = remoteClicks.length > 0;

      const scheduleRemoteClick = (action, index) => {
        if (!action) return;
        const actionLabel =
          (typeof action.label === "string" && action.label.trim()) || `remote_${index + 1}`;
        const getSelector = (value) => (typeof value === "string" ? value.trim() : "");
        const buildPayload = () => {
          const payload = {};
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

      const runTimedText = async (action, kind) => {
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
        const payload = { text: action.text };
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

      const runSpeech = async (action) => {
        if (!action || isStale()) return;
        const target = resolveTarget(action.target_client_id);
        if (action.mode === "sound_play") {
          if (!action.sound_filename) {
            throw new Error("sound_play 需要 sound_filename");
          }
          await queueSoundPlay(action.sound_filename, target, { signal });
          return;
        }
        const base = {
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
          const payload = { ...base };
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
          actionsRan.push(step.tts.mode);
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

      if (isStale()) {
        return;
      }

      if (hasErrors) {
        flushErrors();
      } else if (actionsRan.length > 0 || hasRemoteClicks || actionErrorRef.current) {
        clearActionError();
      }
    },
    [clientId, cancelPendingActions, clearActionError, reportActionError],
  );

  return {
    executeStepActions,
    actionError,
    clearActionError,
    cancelPendingActions,
  };
}
