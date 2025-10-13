import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchKinship,
  fetchCameraPresets,
  saveCameraPreset,
  deleteCameraPreset,
  uploadScreenshot,
  reportScreenshotFailure,
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
  const requestQueueRef = useRef([]);
  const pendingRequestIdsRef = useRef(new Set());
  const isProcessingRef = useRef(false);
  const isCapturingRef = useRef(false);
  const queueTimerRef = useRef(null);
  const wsRef = useRef(null);
  const isMountedRef = useRef(true);
  const incubatorMode = (readParams().get("incubator") ?? "false") === "true";
  const phylogenyMode = !incubatorMode && (readParams().get("phylogeny") ?? "false") === "true";

  const handleFpsUpdate = useCallback((value) => {
    setFps(value);
  }, []);

  const handleCameraUpdate = useCallback((info) => {
    setCameraInfo(info);
  }, []);

  useEffect(() => {
    isCapturingRef.current = isCapturing;
  }, [isCapturing]);

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
      if (queueTimerRef.current) {
        clearTimeout(queueTimerRef.current);
        queueTimerRef.current = null;
      }
      isMountedRef.current = false;
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

  const runCaptureInternal = useCallback(
    async (requestId = null, isAuto = false) => {
      const captureFn = captureFnRef.current;
      if (!captureFn) {
        throw new Error("場景尚未準備好");
      }
      const blob = await captureFn();
      const result = await uploadScreenshot(blob, requestId);
      const label =
        result?.relative_path || result?.filename || (requestId ? `request ${requestId}` : "已上傳");
      const prefix = isAuto ? "自動截圖完成" : "截圖完成";
      pushScreenshotMessage(`${prefix}：${label}`);
      return result;
    },
    [pushScreenshotMessage]
  );

  const processQueue = useCallback(() => {
    if (!isMountedRef.current) return;
    if (isProcessingRef.current) return;

    const next = requestQueueRef.current.shift();
    if (!next) return;

    if (isCapturingRef.current) {
      requestQueueRef.current.unshift(next);
      if (!queueTimerRef.current) {
        queueTimerRef.current = setTimeout(() => {
          queueTimerRef.current = null;
          processQueue();
        }, 400);
      }
      return;
    }

    isProcessingRef.current = true;
    if (queueTimerRef.current) {
      clearTimeout(queueTimerRef.current);
      queueTimerRef.current = null;
    }
    isCapturingRef.current = true;
    if (isMountedRef.current) {
      setIsCapturing(true);
    }

    const request = next;
    (async () => {
      try {
        await runCaptureInternal(request.request_id, true);
      } catch (err) {
        const message = err?.message || String(err);
        pushScreenshotMessage(`自動截圖失敗：${message}`);
        if (request.request_id) {
          try {
            await reportScreenshotFailure(request.request_id, message);
          } catch (reportErr) {
            console.error("回報截圖失敗錯誤", reportErr);
          }
        }
      } finally {
        pendingRequestIdsRef.current.delete(request.request_id);
        isCapturingRef.current = false;
        if (isMountedRef.current) {
          setIsCapturing(false);
        }
        isProcessingRef.current = false;
        if (isMountedRef.current) {
          processQueue();
        }
      }
    })();
  }, [reportScreenshotFailure, runCaptureInternal, pushScreenshotMessage]);

  const enqueueScreenshotRequest = useCallback(
    (payload) => {
      if (!payload || !payload.request_id) return;
      const id = payload.request_id;
      if (pendingRequestIdsRef.current.has(id)) return;
      pendingRequestIdsRef.current.add(id);
      requestQueueRef.current.push(payload);
      const label = payload?.metadata?.label || payload?.metadata?.source || id;
      pushScreenshotMessage(`收到截圖請求：${label}`);
      processQueue();
    },
    [processQueue, pushScreenshotMessage]
  );

  const handleCaptureReady = useCallback(
    (fn) => {
      captureFnRef.current = fn;
      if (fn) {
        processQueue();
      }
    },
    [processQueue]
  );

  useEffect(() => {
    let active = true;
    let retryTimer = null;

    function cleanupSocket() {
      const existing = wsRef.current;
      if (existing) {
        try {
          existing.close();
        } catch (err) {
          // ignore close error
        }
      }
      wsRef.current = null;
    }

    function scheduleReconnect() {
      if (!active || retryTimer) return;
      retryTimer = setTimeout(() => {
        retryTimer = null;
        connect();
      }, 2000);
    }

    function connect() {
      if (!active) return;
      let base = import.meta.env.VITE_API_BASE;
      if (!base) {
        base = window.location.origin;
      }
      base = base.replace(/\/$/, "");
      const wsUrl = `${base.replace(/^http/, "ws")}/ws/screenshots`;

      let socket;
      try {
        socket = new WebSocket(wsUrl);
      } catch (err) {
        console.error("WebSocket 連線失敗", err);
        scheduleReconnect();
        return;
      }

      wsRef.current = socket;

      socket.onmessage = (event) => {
        if (!active) return;
        let payload;
        try {
          payload = JSON.parse(event.data);
        } catch (err) {
          return;
        }

        if (payload?.type === "screenshot_request") {
          enqueueScreenshotRequest(payload);
        } else if (payload?.type === "screenshot_completed" || payload?.type === "screenshot_failed") {
          if (payload?.request_id) {
            pendingRequestIdsRef.current.delete(payload.request_id);
          }
        }
      };

      socket.onclose = () => {
        if (!active) return;
        if (wsRef.current === socket) {
          wsRef.current = null;
        }
        scheduleReconnect();
      };

      socket.onerror = () => {
        socket.close();
      };
    }

    connect();

    return () => {
      active = false;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      cleanupSocket();
    };
  }, [enqueueScreenshotRequest]);

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
      {screenshotMessage && (
        <div className="screenshot-panel">
          <div className="screenshot-message">{screenshotMessage}</div>
        </div>
      )}
    </>
  );
}
