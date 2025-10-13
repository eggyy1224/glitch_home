import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchKinship,
  fetchCameraPresets,
  saveCameraPreset,
  deleteCameraPreset,
  uploadScreenshot,
} from "./api.js";
import KinshipScene from "./ThreeKinshipScene.jsx";

const IMAGES_BASE = import.meta.env.VITE_IMAGES_BASE || "/generated_images/";
const MAX_CLUSTERS = 3;
const DEFAULT_ANCHOR = { x: 0, y: 0, z: 0 };

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
  const [isCapturing, setIsCapturing] = useState(false);
  const [screenshotMessage, setScreenshotMessage] = useState(null);
  const messageTimerRef = useRef(null);
  const screenshotTimerRef = useRef(null);
  const captureFnRef = useRef(null);
  const incubatorMode = (readParams().get("incubator") ?? "false") === "true";
  const phylogenyMode = !incubatorMode && (readParams().get("phylogeny") ?? "false") === "true";

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
      if (screenshotTimerRef.current) {
        clearTimeout(screenshotTimerRef.current);
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
    if (!imgId) return;
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
  }, [imgId, phylogenyMode, incubatorMode]);

  const navigateToImage = (nextImg) => {
    const params = readParams();
    params.set("img", nextImg);
    const qs = params.toString();
    window.history.replaceState(null, "", `?${qs}`);
    setImgId(nextImg);
  };

  // 自動向子代/兄弟/父母切換
  useEffect(() => {
    if (!data) return;
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
  }, [data]);

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

  const pushScreenshotMessage = useCallback((text, ttl = 2500) => {
    setScreenshotMessage(text);
    if (screenshotTimerRef.current) {
      clearTimeout(screenshotTimerRef.current);
    }
    screenshotTimerRef.current = setTimeout(() => {
      setScreenshotMessage(null);
      screenshotTimerRef.current = null;
    }, ttl);
  }, []);

  const handleCaptureReady = useCallback((fn) => {
    captureFnRef.current = fn;
  }, []);

  const handleTakeScreenshot = useCallback(async () => {
    if (!captureFnRef.current) {
      pushScreenshotMessage("場景尚未準備好");
      return;
    }
    setIsCapturing(true);
    try {
      const blob = await captureFnRef.current();
      const result = await uploadScreenshot(blob);
      const label = result?.relative_path || result?.filename || "已上傳";
      pushScreenshotMessage(`截圖完成：${label}`);
    } catch (err) {
      const message = err?.message || String(err);
      pushScreenshotMessage(`截圖失敗：${message}`);
    } finally {
      setIsCapturing(false);
    }
  }, [pushScreenshotMessage]);

  if (!imgId) return <div style={{ padding: 16 }}>請在網址加上 ?img=檔名</div>;
  if (err) return <div style={{ padding: 16 }}>載入失敗：{err}</div>;

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
      <div className="screenshot-panel">
        <button type="button" onClick={handleTakeScreenshot} disabled={isCapturing}>
          {isCapturing ? "截圖中…" : "截圖並上傳"}
        </button>
        {screenshotMessage && <div className="screenshot-message">{screenshotMessage}</div>}
      </div>
    </>
  );
}
