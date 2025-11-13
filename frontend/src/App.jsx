import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchKinship, fetchCameraPresets, saveCameraPreset, deleteCameraPreset } from "./api.js";
import KinshipScene from "./ThreeKinshipScene.jsx";
import SearchMode from "./SearchMode.jsx";
import OrganicRoomScene from "./OrganicRoomScene.jsx";
import SoundPlayer from "./SoundPlayer.jsx";
import SlideMode from "./SlideMode.jsx";
import IframeMode from "./IframeMode.jsx";
import SubtitleOverlay from "./SubtitleOverlay.jsx";
import CaptionMode from "./CaptionMode.jsx";
import CollageMode from "./CollageMode.jsx";
import CollageVersionMode from "./CollageVersionMode.jsx";
import GenerateMode from "./GenerateMode.jsx";
import StaticMode from "./StaticMode.jsx";
import VideoMode from "./VideoMode.jsx";
import DashboardMode from "./DashboardMode.jsx";
import { clampInt } from "./utils/iframeConfig.js";
import { useSubtitleCaption } from "./hooks/useSubtitleCaption.js";
import { useScreenshotManager } from "./hooks/useScreenshotManager.js";
import { useIframeConfig } from "./hooks/useIframeConfig.js";
import { useCollageConfig } from "./hooks/useCollageConfig.js";
import { useControlSocket } from "./hooks/useControlSocket.js";

const IMAGES_BASE = import.meta.env.VITE_IMAGES_BASE || "/generated_images/";
const MAX_CLUSTERS = 3;
const DEFAULT_ANCHOR = { x: 0, y: 0, z: 0 };
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
  const readParams = () => new URLSearchParams(window.location.search);
  const initialParams = useMemo(() => readParams(), []);
  const initialImg = initialParams.get("img");
  const [imgId, setImgId] = useState(initialImg);
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [showInfo, setShowInfo] = useState(false);
  const [clusters, setClusters] = useState([]);
  const [fps, setFps] = useState(null);
  const [cameraInfo, setCameraInfo] = useState(null);
  const [cameraPresets, setCameraPresets] = useState([]);
  const [selectedPresetName, setSelectedPresetName] = useState("");
  const [pendingPreset, setPendingPreset] = useState(null);
  const [presetMessage, setPresetMessage] = useState(null);
  const [soundPlayRequest, setSoundPlayRequest] = useState(null);
  const messageTimerRef = useRef(null);
  const incubatorMode = (readParams().get("incubator") ?? "false") === "true";
  const soundPlayerEnabled = (readParams().get("sound_player") ?? "true") !== "false";
  const dashboardMode =
    !incubatorMode && (readParams().get("dashboard_mode") ?? "false") === "true";
  const iframeMode =
    !incubatorMode && !dashboardMode && (readParams().get("iframe_mode") ?? "false") === "true";
  const slideMode =
    !incubatorMode && !dashboardMode && !iframeMode && (readParams().get("slide_mode") ?? "false") === "true";
  const organicMode =
    !incubatorMode && !dashboardMode && !iframeMode && !slideMode &&
    (readParams().get("organic_mode") ?? "false") === "true";
  const phylogenyMode =
    !incubatorMode && !dashboardMode && !iframeMode && !slideMode && !organicMode &&
    (readParams().get("phylogeny") ?? "false") === "true";
  const searchMode =
    !incubatorMode && !dashboardMode && !iframeMode && !slideMode && !organicMode && !phylogenyMode &&
    (readParams().get("search_mode") ?? "false") === "true";
  const collageMode =
    !incubatorMode && !dashboardMode && !iframeMode && !slideMode && !organicMode && !phylogenyMode && !searchMode &&
    (readParams().get("collage_mode") ?? "false") === "true";
  const captionMode =
    !incubatorMode && !dashboardMode && !iframeMode && !slideMode && !organicMode && !phylogenyMode && !searchMode && !collageMode &&
    (readParams().get("caption_mode") ?? "false") === "true";
  const collageVersionMode =
    !incubatorMode && !dashboardMode && !iframeMode && !slideMode && !organicMode && !phylogenyMode && !searchMode && !collageMode && !captionMode &&
    (readParams().get("collage_version_mode") ?? "false") === "true";
  const generateMode =
    !incubatorMode && !dashboardMode && !iframeMode && !slideMode && !organicMode && !phylogenyMode && !searchMode && !collageMode &&
    !captionMode && !collageVersionMode &&
    (readParams().get("generate_mode") ?? "false") === "true";
  const staticMode =
    !incubatorMode && !dashboardMode && !iframeMode && !slideMode && !organicMode && !phylogenyMode && !searchMode && !collageMode &&
    !captionMode && !collageVersionMode && !generateMode &&
    (readParams().get("static_mode") ?? "false") === "true";
  const videoMode =
    !incubatorMode && !dashboardMode && !iframeMode && !slideMode && !organicMode && !phylogenyMode && !searchMode && !collageMode &&
    !captionMode && !collageVersionMode && !generateMode && !staticMode &&
    (readParams().get("video_mode") ?? "false") === "true";
  const clientId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("client");
    if (fromQuery && fromQuery.trim()) return fromQuery.trim();
    const fromEnv = import.meta.env.VITE_CLIENT_ID;
    if (fromEnv && `${fromEnv}`.trim()) return `${fromEnv}`.trim();
    return "default";
  }, []);

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
    iframeMode,
    clientId,
    defaultConfig: IFRAME_DEFAULT_CONFIG,
  });

  const {
    remoteConfig: collageRemoteConfig,
    remoteSource: collageRemoteSource,
    controlsEnabled: collageControlsEnabled,
    applyRemoteConfig: applyRemoteCollageConfig,
  } = useCollageConfig({
    collageMode,
    clientId,
  });


  const handleFpsUpdate = useCallback((value) => {
    setFps(value);
  }, []);

  const handleCameraUpdate = useCallback((info) => {
    setCameraInfo(info);
  }, []);

  useEffect(() => {
    fetchCameraPresets()
      .then((list) => {
        const arr = Array.isArray(list) ? [...list].sort((a, b) => a.name.localeCompare(b.name)) : [];
        setCameraPresets(arr);
        const defaultPreset = arr.find((p) => p.name === "center");
        if (defaultPreset) {
          setSelectedPresetName(defaultPreset.name);
          setPendingPreset({ ...defaultPreset, key: Date.now() });
        }
      })
      .catch(() => setCameraPresets([]));
  }, []);

  const upsertPresetInState = useCallback((preset) => {
    setCameraPresets((prev) => {
      const next = [...prev];
      const idx = next.findIndex((p) => p.name === preset.name);
      if (idx >= 0) {
        next[idx] = preset;
      } else {
        next.push(preset);
      }
      return next.sort((a, b) => a.name.localeCompare(b.name));
    });
  }, []);

  const removePresetInState = useCallback((name) => {
    setCameraPresets((prev) => prev.filter((p) => p.name !== name));
  }, []);

  const pushPresetMessage = useCallback((text, ttl = 2500) => {
    setPresetMessage(text);
    if (messageTimerRef.current) {
      clearTimeout(messageTimerRef.current);
    }
    messageTimerRef.current = setTimeout(() => {
      setPresetMessage(null);
      messageTimerRef.current = null;
    }, ttl);
  }, []);

  useEffect(() => {
    return () => {
      if (messageTimerRef.current) {
        clearTimeout(messageTimerRef.current);
      }
    };
  }, []);

  const handleSavePreset = useCallback(async () => {
    if (!cameraInfo) {
      window.alert("尚未取得視角資訊，請稍後再試或移動視角。");
      return;
    }
    const rawName = window.prompt("請輸入要儲存的視角名稱：");
    if (!rawName) return;
    const name = rawName.trim();
    if (!name) return;
    const payload = {
      name,
      position: cameraInfo.position,
      target: cameraInfo.target,
    };
    try {
      const saved = await saveCameraPreset(payload);
      upsertPresetInState(saved);
      setSelectedPresetName(saved.name);
      pushPresetMessage(`視角 "${saved.name}" 已儲存。`);
    } catch (err) {
      window.alert(`儲存失敗：${err.message || err}`);
    }
  }, [cameraInfo, upsertPresetInState, pushPresetMessage]);

  const handleApplyPreset = useCallback(() => {
    if (!selectedPresetName) return;
    const preset = cameraPresets.find((p) => p.name === selectedPresetName);
    if (!preset) return;
    setPendingPreset({ ...preset, key: Date.now() });
    pushPresetMessage(`已套用視角 "${preset.name}"。`, 2000);
  }, [cameraPresets, selectedPresetName, pushPresetMessage]);

  const handleDeletePreset = useCallback(async () => {
    if (!selectedPresetName) return;
    const ok = window.confirm(`確定要刪除視角 "${selectedPresetName}" 嗎？`);
    if (!ok) return;
    try {
      await deleteCameraPreset(selectedPresetName);
      removePresetInState(selectedPresetName);
      pushPresetMessage(`視角 "${selectedPresetName}" 已刪除。`, 2000);
      setSelectedPresetName("");
    } catch (err) {
      window.alert(`刪除失敗：${err.message || err}`);
    }
  }, [selectedPresetName, removePresetInState, pushPresetMessage]);

  useEffect(() => {
    if (!imgId || organicMode || slideMode || iframeMode || staticMode || videoMode || dashboardMode) return;
    let cancelled = false;
    setErr(null);
    fetchKinship(imgId, -1)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        if (phylogenyMode || incubatorMode) {
          setClusters([]);
        } else {
          const anchorForCluster = { ...DEFAULT_ANCHOR };
          const originalImage = res?.original_image || imgId;
          const cluster = {
            id: `${originalImage}-${Date.now()}`,
            original: originalImage,
            anchor: anchorForCluster,
            data: res,
          };
          setClusters((prev) => {
            const next = [...prev, cluster];
            if (next.length > MAX_CLUSTERS) next.splice(0, next.length - MAX_CLUSTERS);
            return next;
          });
        }
      })
      .catch((e) => {
        if (!cancelled) setErr(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, [
    imgId,
    phylogenyMode,
    incubatorMode,
    organicMode,
    slideMode,
    iframeMode,
    staticMode,
    videoMode,
    dashboardMode,
  ]);

  const navigateToImage = (nextImg) => {
    const params = readParams();
    params.set("img", nextImg);
    const qs = params.toString();
    window.history.replaceState(null, "", `?${qs}`);
    setImgId(nextImg);
  };

  // 自動向子代/兄弟/父母切換
  useEffect(() => {
    if (!data || organicMode || slideMode || iframeMode || staticMode || videoMode || dashboardMode) return;
    const params = readParams();
    // 新增：continuous=true 時，不自動切換
    const continuous = (params.get("continuous") ?? "false") === "true";
    if (continuous) return;
    const autoplay = (params.get("autoplay") ?? "1") !== "0"; // 預設自動
    if (!autoplay) return;
    const stepSec = Math.max(2, parseInt(params.get("step") || "30"));

    // 記錄已看過避免重複
    const key = "visited_images";
    const visited = new Set(JSON.parse(sessionStorage.getItem(key) || "[]"));
    visited.add(data.original_image);

    const pickFirst = (arr) => arr.find((n) => n && !visited.has(n));
    let next = pickFirst(data.children || []);
    if (!next) next = pickFirst(data.siblings || []);
    if (!next) next = pickFirst(data.parents || []);
    if (!next) next = (data.children || [])[0] || (data.siblings || [])[0] || (data.parents || [])[0];

    sessionStorage.setItem(key, JSON.stringify(Array.from(visited)));

    if (!next) return;
    const t = setTimeout(() => {
      navigateToImage(next);
    }, stepSec * 1000);
    return () => clearTimeout(t);
  }, [data, organicMode, slideMode, iframeMode, staticMode, videoMode, dashboardMode]);

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

  const subtitleOverlay = <SubtitleOverlay subtitle={subtitle} />;

  if (dashboardMode) {
    return <DashboardMode />;
  }

  if (iframeMode) {
    return (
      <>
        <IframeMode
          config={iframeActiveConfig}
          controlsEnabled={iframeControlsEnabled}
          onApplyConfig={iframeControlsEnabled ? handleLocalIframeConfigApply : undefined}
          onCaptureReady={handleCaptureReady}
        />
        {soundPlayerEnabled && (
          <SoundPlayer
            playRequest={soundPlayerEnabled ? soundPlayRequest : null}
            onPlayHandled={() => setSoundPlayRequest(null)}
            visible={showInfo}
          />
        )}
        {subtitleOverlay}
      </>
    );
  }

  if (slideMode) {
    const slideIntervalParam = initialParams.get("slide_interval") || initialParams.get("slide_interval_ms");
    const slideIntervalMs = slideIntervalParam
      ? clampInt(slideIntervalParam, 3000, { min: 1000 })
      : 3000;
    return (
      <>
        <SlideMode
          imagesBase={IMAGES_BASE}
          anchorImage={imgId}
          intervalMs={slideIntervalMs}
          onCaptureReady={handleCaptureReady}
        />
        {soundPlayerEnabled && (
          <SoundPlayer
            playRequest={soundPlayerEnabled ? soundPlayRequest : null}
            onPlayHandled={() => setSoundPlayRequest(null)}
            visible={showInfo}
          />
        )}
        {subtitleOverlay}
      </>
    );
  }

  if (organicMode) {
    return (
      <>
        <OrganicRoomScene
          imagesBase={IMAGES_BASE}
          anchorImage={imgId}
          onSelectImage={navigateToImage}
          showInfo={showInfo}
          onCaptureReady={handleCaptureReady}
        />
        {soundPlayerEnabled && (
          <SoundPlayer
            playRequest={soundPlayerEnabled ? soundPlayRequest : null}
            onPlayHandled={() => setSoundPlayRequest(null)}
            visible={showInfo}
          />
        )}
        {subtitleOverlay}
      </>
    );
  }

  if (searchMode) {
    return (
      <>
        <SearchMode imagesBase={IMAGES_BASE} />
        {soundPlayerEnabled && (
          <SoundPlayer
            playRequest={soundPlayerEnabled ? soundPlayRequest : null}
            onPlayHandled={() => setSoundPlayRequest(null)}
            visible={showInfo}
          />
        )}
        {subtitleOverlay}
      </>
    );
  }

  if (collageMode) {
    return (
      <>
        <CollageMode
          imagesBase={IMAGES_BASE}
          anchorImage={imgId}
          onCaptureReady={handleCaptureReady}
          remoteConfig={collageRemoteConfig}
          controlsEnabled={collageControlsEnabled}
          remoteSource={collageRemoteSource}
        />
        {soundPlayerEnabled && (
          <SoundPlayer
            playRequest={soundPlayerEnabled ? soundPlayRequest : null}
            onPlayHandled={() => setSoundPlayRequest(null)}
            visible={showInfo}
          />
        )}
        {subtitleOverlay}
      </>
    );
  }

  if (captionMode) {
    return (
      <>
        <CaptionMode caption={caption} />
        {soundPlayerEnabled && (
          <SoundPlayer
            playRequest={soundPlayerEnabled ? soundPlayRequest : null}
            onPlayHandled={() => setSoundPlayRequest(null)}
            visible={showInfo}
          />
        )}
        {subtitleOverlay}
      </>
    );
  }

  if (collageVersionMode) {
    return (
      <>
        <CollageVersionMode />
        {soundPlayerEnabled && (
          <SoundPlayer
            playRequest={soundPlayerEnabled ? soundPlayRequest : null}
            onPlayHandled={() => setSoundPlayRequest(null)}
            visible={showInfo}
          />
        )}
        {subtitleOverlay}
      </>
    );
  }

  if (generateMode) {
    return (
      <>
        <GenerateMode />
        {soundPlayerEnabled && (
          <SoundPlayer
            playRequest={soundPlayerEnabled ? soundPlayRequest : null}
            onPlayHandled={() => setSoundPlayRequest(null)}
            visible={showInfo}
          />
        )}
        {subtitleOverlay}
      </>
    );
  }

  if (staticMode) {
    return (
      <>
        <StaticMode
          imagesBase={IMAGES_BASE}
          imgId={imgId}
          onCaptureReady={handleCaptureReady}
        />
        {soundPlayerEnabled && (
          <SoundPlayer
            playRequest={soundPlayerEnabled ? soundPlayRequest : null}
            onPlayHandled={() => setSoundPlayRequest(null)}
            visible={showInfo}
          />
        )}
        {subtitleOverlay}
      </>
    );
  }

  if (videoMode) {
    return (
      <>
        <VideoMode onCaptureReady={handleCaptureReady} />
        {soundPlayerEnabled && (
          <SoundPlayer
            playRequest={soundPlayerEnabled ? soundPlayRequest : null}
            onPlayHandled={() => setSoundPlayRequest(null)}
            visible={showInfo}
          />
        )}
        {subtitleOverlay}
      </>
    );
  }

  if (!imgId)
    return (
      <>
        <div style={{ padding: 16 }}>請在網址加上 ?img=檔名</div>
        {soundPlayerEnabled && (
          <SoundPlayer
            playRequest={soundPlayerEnabled ? soundPlayRequest : null}
            onPlayHandled={() => setSoundPlayRequest(null)}
            visible={showInfo}
          />
        )}
        {subtitleOverlay}
      </>
    );
  if (err)
    return (
      <>
        <div style={{ padding: 16 }}>載入失敗：{err}</div>
        {soundPlayerEnabled && (
          <SoundPlayer
            playRequest={soundPlayerEnabled ? soundPlayRequest : null}
            onPlayHandled={() => setSoundPlayRequest(null)}
            visible={showInfo}
          />
        )}
        {subtitleOverlay}
      </>
    );

  const original = data?.original_image || imgId;
  const related = data?.related_images || [];
  const parents = data?.parents || [];
  const children = data?.children || [];
  const siblings = data?.siblings || [];
  const ancestors = data?.ancestors || [];
  const ancestorsByLevel = data?.ancestors_by_level || [];

  const modeLabel = incubatorMode ? "孵化室 3D" : phylogenyMode ? "親緣圖 2D" : "3D 景觀";

  return (
    <>
      {showInfo && (
        <div className="topbar">
          <div className="badge">模式：{modeLabel}</div>
          <div className="badge">原圖：{original}</div>
          <div className="badge">客戶端：{clientId}</div>
          <div className="badge">關聯：{related.length} 張</div>
          <div className="badge">父母：{parents.length}</div>
          <div className="badge">子代：{children.length}</div>
          <div className="badge">兄弟姊妹：{siblings.length}</div>
          <div className="badge">祖先（去重）：{ancestors.length}</div>
          <div className="badge">FPS：{fps !== null ? fps.toFixed(1) : "--"}</div>
          <div className="badge">
            視角：
            {cameraInfo
              ? `pos(${cameraInfo.position.x.toFixed(1)}, ${cameraInfo.position.y.toFixed(1)}, ${cameraInfo.position.z.toFixed(1)}) ` +
                `target(${cameraInfo.target.x.toFixed(1)}, ${cameraInfo.target.y.toFixed(1)}, ${cameraInfo.target.z.toFixed(1)})`
              : "--"}
          </div>
          <div className="controls">
            <button type="button" onClick={handleSavePreset}>儲存視角</button>
            <select value={selectedPresetName} onChange={(e) => setSelectedPresetName(e.target.value)}>
              <option value="">選擇視角</option>
              {cameraPresets.map((preset) => (
                <option key={preset.name} value={preset.name}>
                  {preset.name}
                </option>
              ))}
            </select>
            <button type="button" onClick={handleApplyPreset} disabled={!selectedPresetName}>
              套用
            </button>
            <button type="button" onClick={handleDeletePreset} disabled={!selectedPresetName}>
              刪除
            </button>
          </div>
          {presetMessage && <div className="badge notice">{presetMessage}</div>}
        </div>
      )}
      <KinshipScene
        imagesBase={IMAGES_BASE}
        clusters={clusters}
        data={data}
        phylogenyMode={phylogenyMode}
        incubatorMode={incubatorMode}
        onPick={(name) => navigateToImage(name)}
        onFpsUpdate={handleFpsUpdate}
        onCameraUpdate={handleCameraUpdate}
        applyPreset={pendingPreset}
        onCaptureReady={handleCaptureReady}
      />
      {screenshotMessage && (
        <div className="screenshot-panel">
          <div className="screenshot-message">{screenshotMessage}</div>
        </div>
      )}
      {soundPlayerEnabled && (
        <SoundPlayer
          playRequest={soundPlayerEnabled ? soundPlayRequest : null}
          onPlayHandled={() => setSoundPlayRequest(null)}
          visible={showInfo}
        />
      )}
      {subtitleOverlay}
    </>
  );
}
