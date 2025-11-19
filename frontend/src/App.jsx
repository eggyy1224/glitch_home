import React, { useCallback, useEffect, useRef, useState } from "react";
import KinshipScene from "./ThreeKinshipScene.jsx";
import SearchMode from "./SearchMode.jsx";
import OrganicRoomScene from "./OrganicRoomScene.jsx";
import SlideMode from "./SlideMode.jsx";
import IframeMode from "./IframeMode.jsx";
import CaptionMode from "./CaptionMode.jsx";
import CollageMode from "./CollageMode.jsx";
import CollageVersionMode from "./CollageVersionMode.jsx";
import GenerateMode from "./GenerateMode.jsx";
import StaticMode from "./StaticMode.jsx";
import VideoMode from "./VideoMode.jsx";
import { useSubtitleCaption } from "./hooks/useSubtitleCaption.js";
import { useScreenshotManager } from "./hooks/useScreenshotManager.js";
import { useIframeConfig } from "./hooks/useIframeConfig.js";
import { useCollageConfig } from "./hooks/useCollageConfig.js";
import { useControlSocket } from "./hooks/useControlSocket.js";
import ModeLayout from "./components/ModeLayout.jsx";
import { DisplayModes } from "./hooks/useDisplayMode.js";
import { useModeParams } from "./hooks/useModeParams.js";
import { useCameraPresets } from "./hooks/useCameraPresets.js";
import { useKinshipData } from "./hooks/useKinshipData.js";
import ControlPanel from "./components/ControlPanel.jsx";
import ScreenshotMessage from "./components/ScreenshotMessage.jsx";
import IframeTimelineControls from "./components/IframeTimelineControls.jsx";
import { useIframeTimelinePlayer } from "./hooks/useIframeTimelinePlayer.js";
import { useTimelineStepActions } from "./hooks/useTimelineStepActions.js";

const SILENT_AUDIO_SRC =
  "data:audio/wav;base64,UklGRqQMAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YYAMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

const IMAGES_BASE = import.meta.env.VITE_IMAGES_BASE || "/generated_images/";
const IFRAME_DEFAULT_CONFIG = {
  layout: "grid",
  gap: 12,
  columns: 2,
  panels: [
    {
      id: "left",
      src: "/?img=offspring_20250929_114732_835.png",
      ratio: 1,
    },
    {
      id: "right",
      src: "/?img=offspring_20250929_112621_888.png&slide_mode=true",
      ratio: 1,
    },
    {
      id: "third",
      src: "/?img=offspring_20250927_141336_787.png&incubator=true",
      ratio: 1,
    },
    {
      id: "fourth",
      src: "/?img=offspring_20251001_181913_443.png&organic_mode=true",
      ratio: 1,
    },
  ],
};


export default function App() {
  const [showInfo, setShowInfo] = useState(false);
  const [fps, setFps] = useState(null);
  const [soundPlayRequest, setSoundPlayRequest] = useState(null);
  const videoControllerRef = useRef(null);
  const unlockAudioElementRef = useRef(null);

  const {
    initialParams,
    initialImg,
    activeMode: defaultActiveMode,
    incubatorMode,
    phylogenyMode,
    soundPlayerEnabled,
    slideIntervalMs,
    clientId,
    iframeTimelineId,
    shouldLoadKinshipData,
  } = useModeParams();

  const [activeModeOverride, setActiveModeOverride] = useState(null);
  const activeMode = activeModeOverride ?? defaultActiveMode;
  const [remoteTimelineControl, setRemoteTimelineControl] = useState(null);
  const remoteTimelineCommandRef = useRef(null);

  const {
    cameraInfo,
    cameraPresets,
    selectedPresetName,
    pendingPreset,
    presetMessage,
    setSelectedPresetName,
    handleCameraUpdate,
    handleSavePreset,
    handleApplyPreset,
    handleDeletePreset,
  } = useCameraPresets();

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
    setActiveModeOverride(null);
  }, []);

  const { imgId, data, err, clusters, navigateToImage } = useKinshipData({
    initialImg,
    shouldLoadKinshipData,
    incubatorMode,
    phylogenyMode,
    maxClusters: 3,
  });

  const { subtitle, caption, applySubtitle, applyCaption } = useSubtitleCaption(clientId);

  const {
    screenshotMessage,
    handleCaptureReady,
    enqueueScreenshotRequest,
    markRequestDone,
  } = useScreenshotManager(clientId);

  const {
    activeConfig: iframeActiveConfig,
    controlsEnabled: iframeControlsEnabled,
    handleLocalApply: handleLocalIframeConfigApply,
    applyRemoteConfig: applyRemoteIframeConfig,
    releaseRemoteConfig: releaseRemoteIframeConfig,
  } = useIframeConfig({
    initialParams,
    iframeMode: activeMode === DisplayModes.IFRAME,
    clientId,
    defaultConfig: IFRAME_DEFAULT_CONFIG,
  });

  const {
    remoteConfig: collageRemoteConfig,
    remoteSource: collageRemoteSource,
    controlsEnabled: collageControlsEnabled,
    applyRemoteConfig: applyRemoteCollageConfig,
  } = useCollageConfig({
    collageMode: activeMode === DisplayModes.COLLAGE,
    clientId,
  });

  const {
    executeStepActions,
    actionError: timelineActionError,
    clearActionError,
    cancelPendingActions,
  } = useTimelineStepActions({ clientId });

  const handleTimelineStepStart = useCallback(
    ({ step, stepIndex, runId }) => {
      if (!effectiveTimelineId) return;
      executeStepActions({ step, stepIndex, timelineId: effectiveTimelineId, runId });
    },
    [executeStepActions, effectiveTimelineId],
  );

  useEffect(() => {
    const audio = document.createElement("audio");
    audio.src = SILENT_AUDIO_SRC;
    audio.preload = "auto";
    audio.loop = false;
    audio.muted = true;
    audio.setAttribute("playsinline", "true");
    audio.style.position = "absolute";
    audio.style.width = "0";
    audio.style.height = "0";
    audio.style.opacity = "0";
    audio.style.pointerEvents = "none";
    document.body?.appendChild(audio);
    unlockAudioElementRef.current = audio;
    return () => {
      audio.pause();
      audio.remove();
      if (unlockAudioElementRef.current === audio) {
        unlockAudioElementRef.current = null;
      }
    };
  }, []);

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

  const handleFpsUpdate = useCallback((value) => {
    setFps(value);
  }, []);

  // Ctrl+R toggle 左上角資訊（避免與瀏覽器刷新衝突：只攔截 Ctrl+R，不處理 Cmd+R/Meta+R）
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey && (e.key === "r" || e.key === "R")) {
        e.preventDefault();
        setShowInfo((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey, { passive: false });
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleScreenshotLifecycle = useCallback(
    (payload) => {
      if (payload?.request_id) {
        markRequestDone(payload.request_id);
      }
    },
    [markRequestDone],
  );

  const handleSoundPlayMessage = useCallback((payload) => {
    if (!payload?.filename) return;
    setSoundPlayRequest({ filename: payload.filename, url: payload.url });
  }, []);

  const handleSubtitleMessage = useCallback(
    (payload) => {
      const targetId = payload?.target_client_id;
      if (targetId && targetId !== clientId) {
        return;
      }
      applySubtitle(payload?.subtitle ?? null);
    },
    [clientId, applySubtitle],
  );

  const handleCaptionMessage = useCallback(
    (payload) => {
      const targetId = payload?.target_client_id;
      if (targetId && targetId !== clientId) {
        return;
      }
      applyCaption(payload?.caption ?? null);
    },
    [clientId, applyCaption],
  );

  const handleIframeConfigMessage = useCallback(
    (payload) => {
      if (!payload?.config) return;
      const targetId = payload?.target_client_id;
      if (targetId && targetId !== clientId) {
        return;
      }
      applyRemoteIframeConfig(payload.config);
    },
    [clientId, applyRemoteIframeConfig],
  );

  const handleCollageConfigMessage = useCallback(
    (payload) => {
      if (!payload?.config) return;
      const targetId = payload?.target_client_id;
      if (targetId && targetId !== clientId) {
        return;
      }
      applyRemoteCollageConfig(payload);
    },
    [clientId, applyRemoteCollageConfig],
  );

  const handleUnlockAudioMessage = useCallback(
    (payload) => {
      const targetId = payload?.target_client_id;
      if (targetId && targetId !== clientId) {
        return;
      }
      const body = document.body;
      const fallbackClick = () => {
        if (!body) return;
        try {
          const clickEvent = new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            view: window,
          });
          body.dispatchEvent(clickEvent);
        } catch (err) {
          // ignore dispatch error and fallback to direct click below
        }
        if (typeof body?.click === "function") {
          body.click();
        }
      };

      try {
        const audio = unlockAudioElementRef.current;
        if (!audio) {
          fallbackClick();
          return;
        }
        try {
          audio.currentTime = 0;
        } catch (err) {
          // ignore seek errors
        }
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.then === "function") {
          playPromise
            .then(() => {
              audio.pause();
            })
            .catch(() => {
              fallbackClick();
            });
        } else {
          fallbackClick();
        }
      } catch (err) {
        fallbackClick();
      }
    },
    [clientId],
  );

  const handleRemoteClickMessage = useCallback(
    (payload) => {
      const targetId = payload?.target_client_id;
      if (targetId && targetId !== clientId) {
        return;
      }
      const fallbackSelector = ".video-mode-container";
      const selector =
        typeof payload?.selector === "string" && payload.selector.trim().length > 0
          ? payload.selector.trim()
          : null;
      const childSelector =
        (typeof payload?.target_selector === "string" && payload.target_selector.trim().length > 0
          ? payload.target_selector.trim()
          : null) ||
        (typeof payload?.target === "string" && payload.target.trim().length > 0
          ? payload.target.trim()
          : null);
      const selectorsProvided = Boolean(selector || childSelector);

      let targetNode = null;
      let rootNode = null;
      if (selector) {
        rootNode = document.querySelector(selector);
      }
      if (rootNode && childSelector) {
        targetNode = rootNode.querySelector(childSelector) || rootNode;
      } else if (rootNode) {
        targetNode = rootNode;
      } else if (childSelector) {
        targetNode = document.querySelector(childSelector);
      }

      if (!targetNode && typeof payload?.x === "number" && typeof payload?.y === "number") {
        targetNode = document.elementFromPoint(payload.x, payload.y);
      }

      if (!targetNode && selectorsProvided && fallbackSelector) {
        targetNode = document.querySelector(fallbackSelector);
      }

      if (!targetNode) {
        return;
      }

      try {
        const clickEvent = new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window,
        });
        targetNode.dispatchEvent(clickEvent);
      } catch (err) {
        // ignore dispatch failure
      }
      if (typeof targetNode.click === "function") {
        targetNode.click();
      }
    },
    [clientId],
  );

  const handleVideoControlMessage = useCallback(
    (payload) => {
      const targetId = payload?.target_client_id;
      if (targetId && targetId !== clientId) {
        return;
      }
      const controller = videoControllerRef.current;
      if (!controller || typeof payload !== "object" || !payload) {
        return;
      }
      const action = typeof payload.action === "string" ? payload.action.trim().toLowerCase() : "";
      if (!action) {
        return;
      }
      if (action === "play") {
        controller.play?.();
        return;
      }
      if (action === "pause") {
        controller.pause?.();
        return;
      }
      if (action === "seek" && payload.time != null) {
        controller.seek?.(payload.time);
        return;
      }
      if (action === "set_volume" || action === "volume") {
        controller.setVolume?.(payload.volume);
        return;
      }
      if (action === "set_muted") {
        controller.setMuted?.(payload.muted);
        return;
      }
      if (action === "mute") {
        controller.setMuted?.(true);
        return;
      }
      if (action === "unmute") {
        controller.setMuted?.(false);
        if (payload.volume != null) {
          controller.setVolume?.(payload.volume);
        }
        return;
      }
    },
    [clientId],
  );

  const handleTimelineControlMessage = useCallback(
    (payload) => {
      if (!payload || typeof payload !== "object") {
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
        const forceMode = options.forceIframeMode !== false;
        if (forceMode) {
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
    [clientId, remoteTimelineControl, effectiveTimelineId, performTimelineStop],
  );

  useControlSocket({
    clientId,
    onScreenshotRequest: enqueueScreenshotRequest,
    onScreenshotLifecycle: handleScreenshotLifecycle,
    onSoundPlay: handleSoundPlayMessage,
    onSubtitleUpdate: handleSubtitleMessage,
    onCaptionUpdate: handleCaptionMessage,
    onIframeConfig: handleIframeConfigMessage,
    onCollageConfig: handleCollageConfigMessage,
    onUnlockAudio: handleUnlockAudioMessage,
    onRemoteClick: handleRemoteClickMessage,
    onVideoControl: handleVideoControlMessage,
    onTimelineControl: handleTimelineControlMessage,
  });

  const handleSoundHandled = useCallback(() => {
    setSoundPlayRequest(null);
  }, []);

  if (activeMode === DisplayModes.KINSHIP && !imgId) {
    return (
      <ModeLayout
        beforeContent={<div style={{ padding: 16 }}>請在網址加上 ?img=檔名</div>}
        soundPlayerEnabled={soundPlayerEnabled}
        soundPlayRequest={soundPlayRequest}
        onSoundHandled={handleSoundHandled}
        showInfo={showInfo}
        subtitle={subtitle}
        onCaptureReady={handleCaptureReady}
      />
    );
  }

  if (activeMode === DisplayModes.KINSHIP && err) {
    return (
      <ModeLayout
        beforeContent={<div style={{ padding: 16 }}>載入失敗：{err}</div>}
        soundPlayerEnabled={soundPlayerEnabled}
        soundPlayRequest={soundPlayRequest}
        onSoundHandled={handleSoundHandled}
        showInfo={showInfo}
        subtitle={subtitle}
        onCaptureReady={handleCaptureReady}
      />
    );
  }

  const original = data?.original_image || imgId;
  const related = data?.related_images || [];
  const parents = data?.parents || [];
  const children = data?.children || [];
  const siblings = data?.siblings || [];
  const ancestors = data?.ancestors || [];
  const modeLabel = incubatorMode ? "孵化室 3D" : phylogenyMode ? "親緣圖 2D" : "3D 景觀";

  const topbarContent = (
    <ControlPanel
      visible={showInfo}
      modeLabel={modeLabel}
      originalImage={original}
      clientId={clientId}
      relatedCount={related.length}
      parentsCount={parents.length}
      childrenCount={children.length}
      siblingsCount={siblings.length}
      ancestorsCount={ancestors.length}
      fps={fps}
      cameraInfo={cameraInfo}
      presets={cameraPresets}
      selectedPresetName={selectedPresetName}
      onSelectPreset={setSelectedPresetName}
      onSavePreset={handleSavePreset}
      onApplyPreset={handleApplyPreset}
      onDeletePreset={handleDeletePreset}
      presetMessage={presetMessage}
      subtitle={subtitle}
      caption={caption}
    />
  );

  const screenshotContent = <ScreenshotMessage message={screenshotMessage} />;

  const iframeTimelineOverlay =
    activeMode === DisplayModes.IFRAME && effectiveTimelineId ? (
      <IframeTimelineControls
        timelineId={effectiveTimelineId}
        timeline={timeline}
        currentStep={currentStep}
        currentStepIndex={currentStepIndex}
        status={timelineStatus}
        isPlaying={timelineIsPlaying}
        loading={timelineLoading}
        error={timelineError}
        actionError={timelineActionError}
        onPlay={playTimeline}
        onPause={pauseTimeline}
        onStop={handleStopTimeline}
        onNext={nextTimelineStep}
        onPrevious={previousTimelineStep}
        onReload={reloadTimeline}
      />
    ) : null;

  const modeRenderMap = {
    [DisplayModes.IFRAME]: {
      component: IframeMode,
      withCaptureReady: true,
      componentProps: {
        config: iframeActiveConfig,
        controlsEnabled: iframeControlsEnabled,
        onApplyConfig: iframeControlsEnabled ? handleLocalIframeConfigApply : undefined,
      },
      beforeContent: iframeTimelineOverlay,
    },
    [DisplayModes.SLIDE]: {
      component: SlideMode,
      withCaptureReady: true,
      componentProps: {
        imagesBase: IMAGES_BASE,
        anchorImage: imgId,
        intervalMs: slideIntervalMs,
      },
    },
    [DisplayModes.ORGANIC]: {
      component: OrganicRoomScene,
      withCaptureReady: true,
      componentProps: {
        imagesBase: IMAGES_BASE,
        anchorImage: imgId,
        onSelectImage: navigateToImage,
        showInfo,
      },
    },
    [DisplayModes.SEARCH]: {
      component: SearchMode,
      componentProps: {
        imagesBase: IMAGES_BASE,
      },
    },
    [DisplayModes.COLLAGE]: {
      component: CollageMode,
      withCaptureReady: true,
      componentProps: {
        imagesBase: IMAGES_BASE,
        anchorImage: imgId,
        remoteConfig: collageRemoteConfig,
        controlsEnabled: collageControlsEnabled,
        remoteSource: collageRemoteSource,
      },
    },
    [DisplayModes.CAPTION]: {
      component: CaptionMode,
      componentProps: {
        caption,
      },
    },
    [DisplayModes.COLLAGE_VERSION]: {
      component: CollageVersionMode,
    },
    [DisplayModes.GENERATE]: {
      component: GenerateMode,
    },
    [DisplayModes.STATIC]: {
      component: StaticMode,
      withCaptureReady: true,
      componentProps: {
        imagesBase: IMAGES_BASE,
        imgId,
      },
    },
    [DisplayModes.VIDEO]: {
      component: VideoMode,
      withCaptureReady: true,
      componentProps: {
        controlRef: videoControllerRef,
      },
    },
    [DisplayModes.KINSHIP]: {
      component: KinshipScene,
      withCaptureReady: true,
      componentProps: {
        imagesBase: IMAGES_BASE,
        clusters,
        data,
        phylogenyMode,
        incubatorMode,
        onPick: navigateToImage,
        onFpsUpdate: handleFpsUpdate,
        onCameraUpdate: handleCameraUpdate,
        applyPreset: pendingPreset,
      },
      beforeContent: topbarContent,
      afterContent: screenshotContent,
    },
  };

  const activeModeEntry = modeRenderMap[activeMode];

  if (!activeModeEntry) {
    return null;
  }

  return (
    <ModeLayout
      component={activeModeEntry.component}
      componentProps={activeModeEntry.componentProps}
      withCaptureReady={activeModeEntry.withCaptureReady}
      beforeContent={activeModeEntry.beforeContent}
      afterContent={activeModeEntry.afterContent}
      soundPlayerEnabled={soundPlayerEnabled}
      soundPlayRequest={soundPlayerEnabled ? soundPlayRequest : null}
      onSoundHandled={handleSoundHandled}
      showInfo={showInfo}
      subtitle={subtitle}
      onCaptureReady={handleCaptureReady}
    />
  );
}
