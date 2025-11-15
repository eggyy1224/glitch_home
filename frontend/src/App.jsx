import React, { useCallback, useEffect, useState } from "react";
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

  const {
    initialParams,
    initialImg,
    activeMode,
    incubatorMode,
    phylogenyMode,
    soundPlayerEnabled,
    slideIntervalMs,
    clientId,
    shouldLoadKinshipData,
  } = useModeParams();

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

  useControlSocket({
    clientId,
    onScreenshotRequest: enqueueScreenshotRequest,
    onScreenshotLifecycle: handleScreenshotLifecycle,
    onSoundPlay: handleSoundPlayMessage,
    onSubtitleUpdate: handleSubtitleMessage,
    onCaptionUpdate: handleCaptionMessage,
    onIframeConfig: handleIframeConfigMessage,
    onCollageConfig: handleCollageConfigMessage,
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

  const modeRenderMap = {
    [DisplayModes.IFRAME]: {
      component: IframeMode,
      withCaptureReady: true,
      componentProps: {
        config: iframeActiveConfig,
        controlsEnabled: iframeControlsEnabled,
        onApplyConfig: iframeControlsEnabled ? handleLocalIframeConfigApply : undefined,
      },
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
