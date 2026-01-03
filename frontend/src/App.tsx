import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppMode } from "./appMode/AppModeContext";
import { useSubtitleCaption } from "./hooks/useSubtitleCaption";
import { useScreenshotManager } from "./hooks/useScreenshotManager";
import { useIframeConfig } from "./hooks/useIframeConfig";
import { useCollageConfig } from "./hooks/useCollageConfig";
import { useControlSocket } from "./hooks/useControlSocket";
import ModeLayout from "./components/ModeLayout";
import { DisplayModes, type DisplayModeType } from "./hooks/useDisplayMode";
import { useModeParams, KINSHIP_DATA_EXCLUDED } from "./hooks/useModeParams";
import { useCameraPresets } from "./hooks/useCameraPresets";
import { useKinshipData } from "./hooks/useKinshipData";
import ControlPanel from "./components/ControlPanel";
import ScreenshotMessage from "./components/ScreenshotMessage";
import IframeTimelineControls from "./components/IframeTimelineControls";
import IframeAutoModeControls from "./components/IframeAutoModeControls";
import { useSoundQueue } from "./hooks/useSoundQueue";
import { useRemoteTimelineControl } from "./hooks/useRemoteTimelineControl";
import { useControlSocketHandlers } from "./hooks/useControlSocketHandlers";
import { createModeRenderMap, type ModeRenderEntry } from "./modes/createModeRenderMap";
import { useSilentAudioUnlock } from "./hooks/useSilentAudioUnlock";
import { useIframeAutoRotation } from "./hooks/useIframeAutoRotation";
import type { VideoController } from "./types/control";
import ExhibitionCameraPanel from "./components/ExhibitionCameraPanel";

const IMAGES_BASE = import.meta.env.VITE_IMAGES_BASE || "/generated_images/";
const CAMERA_SCOPE_KINSHIP = "kinship";
const CAMERA_SCOPE_EXHIBITION = "exhibition";
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
  const [fps, setFps] = useState<number | null>(null);
  const videoControllerRef = useRef<VideoController | null>(null);
  const unlockAudioElementRef = useSilentAudioUnlock() as React.MutableRefObject<HTMLAudioElement | null>;

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
  } = useModeParams();

  const autoModeRequested = useMemo(() => {
    const rawValue = initialParams.get("auto_mode");
    return String(rawValue ?? "false").trim().toLowerCase() === "true";
  }, [initialParams]);

  const { appMode, capabilities } = useAppMode();
  const canGenerate = capabilities?.canGenerate ?? true;
  const canWriteMetadata = capabilities?.canWriteMetadata ?? true;
  const canWriteAssets = capabilities?.canWriteAssets ?? true;
  const canAnalyze = capabilities?.canAnalyze ?? true;
  const canRebuildIndex = capabilities?.canRebuildIndex ?? true;
  const forbidMessage = `目前 APP_MODE=${appMode} 禁止此操作`;

  const [activeModeOverride, setActiveModeOverride] = useState<DisplayModeType | null>(null);
  const rawActiveMode = activeModeOverride ?? defaultActiveMode;
  const activeMode = (() => {
    if (!canGenerate && (rawActiveMode === DisplayModes.GENERATE || rawActiveMode === DisplayModes.COLLAGE_VERSION)) {
      return DisplayModes.KINSHIP;
    }
    if (!canWriteMetadata && rawActiveMode === DisplayModes.ADMIN) {
      return DisplayModes.KINSHIP;
    }
    return rawActiveMode;
  })();
  const shouldLoadKinshipData = !KINSHIP_DATA_EXCLUDED.has(activeMode);

  const {
    cameraInfo: cameraInfoKinship,
    cameraPresets: cameraPresetsKinship,
    selectedPresetName: selectedPresetNameKinship,
    pendingPreset: pendingPresetKinship,
    presetMessage: presetMessageKinship,
    setSelectedPresetName: setSelectedPresetNameKinship,
    handleCameraUpdate: handleCameraUpdateKinship,
    handleSavePreset: handleSavePresetKinship,
    handleApplyPreset: handleApplyPresetKinship,
    handleDeletePreset: handleDeletePresetKinship,
  } = useCameraPresets({ scope: CAMERA_SCOPE_KINSHIP });

  const {
    cameraInfo: cameraInfoExhibition,
    cameraPresets: cameraPresetsExhibition,
    selectedPresetName: selectedPresetNameExhibition,
    pendingPreset: pendingPresetExhibition,
    presetMessage: presetMessageExhibition,
    setSelectedPresetName: setSelectedPresetNameExhibition,
    handleCameraUpdate: handleCameraUpdateExhibition,
    handleSavePreset: handleSavePresetExhibition,
    handleApplyPreset: handleApplyPresetExhibition,
    handleDeletePreset: handleDeletePresetExhibition,
  } = useCameraPresets({ scope: CAMERA_SCOPE_EXHIBITION });

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
  } = useScreenshotManager(clientId, { canWriteAssets, forbidMessage });

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
    skipServerFetch: false,
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

  const { soundPlayRequest, handleSoundPlayMessage, handleSoundHandled } = useSoundQueue();

  const {
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
    nextTimelineStep,
    previousTimelineStep,
    reloadTimeline,
    handleStopTimeline,
    handleTimelineControlMessage,
  } = useRemoteTimelineControl({
    activeMode,
    iframeTimelineId,
    clientId,
    applyRemoteIframeConfig,
    releaseRemoteIframeConfig,
    setActiveModeOverride,
    capabilities: { canWriteAssets, canAnalyze, forbidMessage },
  });

  const autoRotationEnabled = activeMode === DisplayModes.IFRAME && autoModeRequested && !effectiveTimelineId;
  const applyAutoRotationConfig = useCallback(
    (config: Record<string, unknown>) => {
      applyRemoteIframeConfig(config as Record<string, unknown>);
    },
    [applyRemoteIframeConfig],
  );
  const iframeAutoRotation = useIframeAutoRotation({
    enabled: autoRotationEnabled,
    clientId,
    onApplyConfig: applyAutoRotationConfig,
  });

  const {
    handleScreenshotLifecycle,
    handleSubtitleMessage,
    handleCaptionMessage,
    handleIframeConfigMessage,
    handleCollageConfigMessage,
    handleUnlockAudioMessage,
    handleRemoteClickMessage,
    handleVideoControlMessage,
  } = useControlSocketHandlers({
    clientId,
    applySubtitle,
    applyCaption,
    applyRemoteIframeConfig,
    applyRemoteCollageConfig,
    markRequestDone,
    unlockAudioElementRef,
    videoControllerRef,
  });

  const handleFpsUpdate = useCallback((value: number | null) => {
    setFps(value);
  }, []);

  // Ctrl+R toggle 左上角資訊（避免與瀏覽器刷新衝突：只攔截 Ctrl+R，不處理 Cmd+R/Meta+R）
  // VJ mode / vj_video_mode 由各自的元件接管 Ctrl+R（開關麥克風）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.key === "r" || e.key === "R")) {
        e.preventDefault();
        if (activeMode === DisplayModes.VJ || activeMode === DisplayModes.VJ_VIDEO) return;
        setShowInfo((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey, { passive: false });
    return () => window.removeEventListener("keydown", onKey);
  }, [activeMode]);

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

  const captureReadyHandler = handleCaptureReady as (...args: unknown[]) => void;

  if (activeMode === DisplayModes.KINSHIP && !imgId) {
    return (
      <ModeLayout
        beforeContent={<div style={{ padding: 16 }}>請在網址加上 ?img=檔名</div>}
        soundPlayerEnabled={soundPlayerEnabled}
        soundPlayRequest={soundPlayRequest}
        onSoundHandled={handleSoundHandled}
        showInfo={showInfo}
        subtitle={subtitle}
        onCaptureReady={captureReadyHandler}
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
        onCaptureReady={captureReadyHandler}
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

  const subtitleText = subtitle?.text ?? null;
  const captionText = caption?.text ?? null;

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
      cameraInfo={cameraInfoKinship}
      presets={cameraPresetsKinship}
      selectedPresetName={selectedPresetNameKinship}
      onSelectPreset={setSelectedPresetNameKinship}
      onSavePreset={handleSavePresetKinship}
      onApplyPreset={handleApplyPresetKinship}
      onDeletePreset={handleDeletePresetKinship}
      presetMessage={presetMessageKinship}
      subtitle={subtitleText}
      caption={captionText}
    />
  );

  const screenshotContent = <ScreenshotMessage message={screenshotMessage} />;

  const exhibitionTopbarContent = (
    <ExhibitionCameraPanel
      visible={showInfo}
      cameraInfo={cameraInfoExhibition}
      presets={cameraPresetsExhibition}
      selectedPresetName={selectedPresetNameExhibition}
      onSelectPreset={setSelectedPresetNameExhibition}
      onSavePreset={handleSavePresetExhibition}
      onApplyPreset={handleApplyPresetExhibition}
      onDeletePreset={handleDeletePresetExhibition}
      presetMessage={presetMessageExhibition}
    />
  );

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

  const iframeAutoModeOverlay =
    activeMode === DisplayModes.IFRAME && autoModeRequested ? (
      <IframeAutoModeControls
        enabled={autoRotationEnabled}
        status={iframeAutoRotation.status}
        statusText={iframeAutoRotation.statusText}
        error={iframeAutoRotation.error}
        isPlaying={iframeAutoRotation.isPlaying}
        queue={iframeAutoRotation.queue}
        current={iframeAutoRotation.current}
        onTogglePlay={iframeAutoRotation.togglePlay}
        onNext={iframeAutoRotation.next}
        onPrevious={iframeAutoRotation.previous}
        onReload={iframeAutoRotation.reload}
      />
    ) : null;

  const iframeOverlays =
    iframeTimelineOverlay || iframeAutoModeOverlay ? (
      <>
        {iframeTimelineOverlay}
        {iframeAutoModeOverlay}
      </>
    ) : null;

  const modeRenderMap = createModeRenderMap({
    iframeActiveConfig,
    iframeControlsEnabled,
    handleLocalIframeConfigApply,
    iframeTimelineOverlay: iframeOverlays,
    imagesBase: IMAGES_BASE,
    imgId,
    slideIntervalMs,
    navigateToImage,
    showInfo,
    collageRemoteConfig,
    collageControlsEnabled,
    collageRemoteSource,
    caption,
    videoControllerRef,
    clusters,
    data,
    phylogenyMode,
    incubatorMode,
    handleFpsUpdate,
    handleCameraUpdate: handleCameraUpdateKinship,
    pendingPreset: pendingPresetKinship,
    topbarContent,
    screenshotContent,
    exhibitionBeforeContent: exhibitionTopbarContent,
    handleExhibitionCameraUpdate: handleCameraUpdateExhibition,
    exhibitionPendingPreset: pendingPresetExhibition,
    clientId,
    canGenerate,
    canWriteMetadata,
    canWriteAssets,
    appMode,
    forbidMessage,
    canAnalyze,
    canRebuildIndex,
  });

  const activeModeEntry: ModeRenderEntry | undefined = modeRenderMap[activeMode];

  if (!activeModeEntry) {
    return null;
  }

  return (
    <Suspense fallback={<div style={{ padding: 16 }}>載入中…</div>}>
      <ModeLayout
        component={activeModeEntry.component}
        componentProps={activeModeEntry.componentProps}
        withCaptureReady={Boolean(activeModeEntry.withCaptureReady)}
        beforeContent={activeModeEntry.beforeContent}
        afterContent={activeModeEntry.afterContent}
        soundPlayerEnabled={soundPlayerEnabled}
        soundPlayRequest={soundPlayerEnabled ? soundPlayRequest : null}
        onSoundHandled={handleSoundHandled}
        showInfo={showInfo}
        subtitle={subtitle}
        onCaptureReady={captureReadyHandler}
      />
    </Suspense>
  );
}
