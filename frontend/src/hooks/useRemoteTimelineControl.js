import { useCallback, useEffect, useRef, useState } from "react";
import { DisplayModes } from "./useDisplayMode.js";
import { useIframeTimelinePlayer } from "./useIframeTimelinePlayer.js";
import { useTimelineStepActions } from "./useTimelineStepActions.js";

export function useRemoteTimelineControl({
  activeMode,
  iframeTimelineId,
  clientId,
  applyRemoteIframeConfig,
  releaseRemoteIframeConfig,
  setActiveModeOverride,
  capabilities,
}) {
  const [remoteTimelineControl, setRemoteTimelineControl] = useState(null);
  const remoteTimelineCommandRef = useRef(null);

  const {
    executeStepActions,
    actionError: timelineActionError,
    clearActionError,
    cancelPendingActions,
  } = useTimelineStepActions({ clientId, capabilities });

  const effectiveTimelineId = remoteTimelineControl?.timelineId ?? iframeTimelineId;
  const remoteTimelineInitialStep = remoteTimelineControl?.startStep ?? null;
  const remoteTimelineAutoPlay = remoteTimelineControl ? remoteTimelineControl.autoPlay : true;
  const remoteTimelineLoopOverride =
    remoteTimelineControl && typeof remoteTimelineControl.loopOverride === "boolean"
      ? remoteTimelineControl.loopOverride
      : null;
  const remoteTimelineSessionKey = remoteTimelineControl?.sessionKey ?? null;

  const releaseRemoteTimelineControl = useCallback(() => {
    setRemoteTimelineControl(null);
    remoteTimelineCommandRef.current = null;
    setActiveModeOverride?.(null);
  }, [setActiveModeOverride]);

  const handleTimelineStepStart = useCallback(
    ({ step, stepIndex, runId }) => {
      if (!effectiveTimelineId) return;
      executeStepActions({ step, stepIndex, timelineId: effectiveTimelineId, runId });
    },
    [executeStepActions, effectiveTimelineId],
  );

  const {
    timeline,
    currentStep,
    currentStepIndex,
    status: timelineStatus,
    isPlaying: timelineIsPlaying,
    loading: timelineLoading,
    error: timelineError,
    play: playTimeline,
    pause: pauseTimeline,
    stop: stopTimeline,
    next: nextTimelineStep,
    previous: previousTimelineStep,
    reload: reloadTimeline,
  } = useIframeTimelinePlayer({
    timelineId: effectiveTimelineId,
    isActive: activeMode === DisplayModes.IFRAME,
    applyRemoteConfig: applyRemoteIframeConfig,
    releaseRemoteConfig: releaseRemoteIframeConfig,
    onStepStart: handleTimelineStepStart,
    initialStep: remoteTimelineInitialStep,
    autoPlayOnLoad: remoteTimelineAutoPlay,
    loopOverride: remoteTimelineLoopOverride,
    sessionKey: remoteTimelineSessionKey,
  });

  useEffect(() => {
    if (!effectiveTimelineId || activeMode !== DisplayModes.IFRAME) {
      cancelPendingActions();
      clearActionError();
    }
  }, [effectiveTimelineId, activeMode, cancelPendingActions, clearActionError]);

  const performTimelineStop = useCallback(
    (releaseRemote = true) => {
      cancelPendingActions();
      stopTimeline();
      if (releaseRemote && remoteTimelineControl) {
        releaseRemoteTimelineControl();
      }
    },
    [cancelPendingActions, stopTimeline, remoteTimelineControl, releaseRemoteTimelineControl],
  );

  const handleStopTimeline = useCallback(
    (event) => {
      if (event && typeof event.preventDefault === "function") {
        event.preventDefault();
      }
      performTimelineStop(true);
    },
    [performTimelineStop],
  );

  const handleTimelineControlMessage = useCallback(
    (payload) => {
      if (!payload || typeof payload !== "object") {
        return;
      }
      if (activeMode === DisplayModes.ADMIN) {
        return;
      }
      const targetId = payload?.target_client_id;
      if (targetId && targetId !== clientId) {
        return;
      }
      const action = typeof payload?.action === "string" ? payload.action.toLowerCase() : "";
      const options = payload?.options && typeof payload.options === "object" ? payload.options : {};
      const commandId = options.commandId || payload?.command_id || payload?.commandId || null;
      if (commandId) {
        const previousEntry = remoteTimelineCommandRef.current;
        if (previousEntry && previousEntry.id === commandId && previousEntry.action === action) {
          return;
        }
      }
      if (action === "play") {
        const timelineId = payload?.timeline_id;
        if (!timelineId) {
          return;
        }
        remoteTimelineCommandRef.current = commandId ? { id: commandId, action } : null;
        const startFrom =
          typeof options.startStep === "number" && Number.isFinite(options.startStep)
            ? Math.max(0, Math.floor(options.startStep))
            : null;
        const loopOverride = typeof options.loop === "boolean" ? Boolean(options.loop) : null;
        setRemoteTimelineControl({
          timelineId,
          startStep: startFrom,
          autoPlay: options.autoPlay !== false,
          loopOverride,
          sessionKey: commandId || `${timelineId}:${Date.now()}`,
        });
        if (options.forceIframeMode !== false && setActiveModeOverride) {
          setActiveModeOverride(DisplayModes.IFRAME);
        }
        return;
      }
      if (action === "stop") {
        const requestedTimelineId =
          typeof payload?.timeline_id === "string" && payload.timeline_id.trim().length > 0
            ? payload.timeline_id.trim()
            : null;
        if (requestedTimelineId) {
          if (remoteTimelineControl) {
            if (remoteTimelineControl.timelineId !== requestedTimelineId) {
              return;
            }
          } else if (effectiveTimelineId && effectiveTimelineId !== requestedTimelineId) {
            return;
          }
        }
        remoteTimelineCommandRef.current = commandId ? { id: commandId, action } : null;
        const shouldRelease = options.releaseControl !== false;
        performTimelineStop(shouldRelease);
      }
    },
    [
      clientId,
      remoteTimelineControl,
      effectiveTimelineId,
      performTimelineStop,
      activeMode,
      setActiveModeOverride,
    ],
  );

  return {
    effectiveTimelineId,
    timeline,
    currentStep,
    currentStepIndex,
    timelineStatus,
    timelineIsPlaying,
    timelineLoading,
    timelineError,
    timelineActionError,
    playTimeline,
    pauseTimeline,
    stopTimeline,
    nextTimelineStep,
    previousTimelineStep,
    reloadTimeline,
    handleStopTimeline,
    handleTimelineControlMessage,
  };
}
