import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchKinship,
  fetchCameraPresets,
  saveCameraPreset,
  deleteCameraPreset,
  uploadScreenshot,
  reportScreenshotFailure,
  fetchSubtitleState,
  fetchCaptionState,
} from "./api.js";
import KinshipScene from "./ThreeKinshipScene.jsx";
import SearchMode from "./SearchMode.jsx";
import OrganicRoomScene from "./OrganicRoomScene.jsx";
import SoundPlayer from "./SoundPlayer.jsx";
import SlideMode from "./SlideMode.jsx";
import IframeMode from "./IframeMode.jsx";
import SubtitleOverlay from "./SubtitleOverlay.jsx";
import CaptionMode from "./CaptionMode.jsx";

const IMAGES_BASE = import.meta.env.VITE_IMAGES_BASE || "/generated_images/";
const MAX_CLUSTERS = 3;
const DEFAULT_ANCHOR = { x: 0, y: 0, z: 0 };

const IFRAME_LAYOUTS = new Set(["grid", "horizontal", "vertical"]);

// Control whether iframe config is mirrored into the URL as query params.
// Default: false (compact URL). Set VITE_IFRAME_PERSIST_QUERY=true to enable old behavior.
const PERSIST_IFRAME_QUERY =
  String(import.meta.env.VITE_IFRAME_PERSIST_QUERY ?? "false").trim().toLowerCase() === "true";

const normalizeIframeLayout = (value, fallback = "grid") => {
  const candidate = (value || "").toString().trim().toLowerCase();
  return IFRAME_LAYOUTS.has(candidate) ? candidate : fallback;
};

const clampInt = (value, fallback, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const intVal = Math.floor(parsed);
  if (intVal < min) return min;
  if (intVal > max) return max;
  return intVal;
};

const parseRatio = (value, fallback = 1) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const parseIframeConfigFromParams = (params) => {
  if (!params) return null;

  const layout = normalizeIframeLayout(params.get("iframe_layout"));
  const gap = clampInt(params.get("iframe_gap"), 0, { min: 0 });
  const columns = clampInt(params.get("iframe_columns"), 2, { min: 1 });

  const rawKeys = (params.get("iframe_panels") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const panels = [];
  const keys = rawKeys.length ? rawKeys : null;

  if (keys) {
    keys.forEach((key, index) => {
      const src = params.get(`iframe_${key}`);
      if (!src) return;
      const ratio = parseRatio(params.get(`iframe_${key}_ratio`), 1);
      const label = params.get(`iframe_${key}_label`) || undefined;
      panels.push({
        id: key || `panel_${index + 1}`,
        src,
        ratio,
        label,
      });
    });
  } else {
    for (let index = 1; index <= 12; index += 1) {
      const key = `${index}`;
      const src = params.get(`iframe_${key}`);
      if (!src) break;
      const ratio = parseRatio(params.get(`iframe_${key}_ratio`), 1);
      const label = params.get(`iframe_${key}_label`) || undefined;
      panels.push({
        id: key,
        src,
        ratio,
        label,
      });
    }
  }

  if (!panels.length) {
    return null;
  }

  return { layout, gap, columns, panels };
};

const sanitizeIframePanels = (panels, fallbackPanels = []) => {
  if (!Array.isArray(panels)) return [...fallbackPanels];
  const usedIds = new Set();
  const result = [];
  const clampSpan = (value) => {
    if (value === null || value === undefined) return undefined;
    const parsed = clampInt(value, 1, { min: 1 });
    return parsed || 1;
  };
  panels.forEach((panel, index) => {
    if (!panel || typeof panel !== "object") return;
    const src = typeof panel.src === "string" ? panel.src.trim() : "";
    if (!src) return;
    let id = typeof panel.id === "string" && panel.id.trim() ? panel.id.trim() : `panel_${index + 1}`;
    if (usedIds.has(id)) {
      id = `${id}_${index + 1}`;
    }
    usedIds.add(id);
    const ratio = parseRatio(panel.ratio, 1);
    const label = typeof panel.label === "string" && panel.label.trim() ? panel.label.trim() : undefined;
    const colSpan = clampSpan(panel.col_span ?? panel.colSpan);
    const rowSpan = clampSpan(panel.row_span ?? panel.rowSpan);
    result.push({
      id,
      src,
      ratio,
      label,
      image: panel.image,
      params: panel.params,
      url: panel.url,
      colSpan,
      rowSpan,
    });
  });
  return result.length ? result : [...fallbackPanels];
};

const sanitizeIframeConfig = (config, fallback) => {
  const base = fallback || { layout: "grid", gap: 0, columns: 2, panels: [] };
  if (!config || typeof config !== "object") {
    return { ...base, panels: [...(base.panels || [])] };
  }
  const layout = normalizeIframeLayout(config.layout, base.layout);
  const gap = clampInt(config.gap, base.gap, { min: 0 });
  const columns = clampInt(config.columns, base.columns, { min: 1 });
  const panels = sanitizeIframePanels(config.panels, base.panels || []);
  return { layout, gap, columns, panels };
};

const buildQueryFromIframeConfig = (config) => {
  if (!config || typeof config !== "object") return null;
  const panels = Array.isArray(config.panels) ? config.panels : [];
  if (!panels.length) return null;
  const keys = panels.map((_, index) => `p${index + 1}`);
  const entries = [];
  entries.push(["iframe_panels", keys.join(",")]);
  entries.push(["iframe_layout", config.layout]);
  entries.push(["iframe_gap", String(config.gap ?? 0)]);
  entries.push(["iframe_columns", String(config.columns ?? 2)]);
  panels.forEach((panel, index) => {
    const key = keys[index];
    if (!panel || typeof panel !== "object") return;
    if (panel.src) {
      entries.push([`iframe_${key}`, panel.src]);
    }
    if (panel.label) {
      entries.push([`iframe_${key}_label`, panel.label]);
    }
    if (panel.ratio && panel.ratio !== 1) {
      entries.push([`iframe_${key}_ratio`, String(panel.ratio)]);
    }
  });
  return entries;
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
  const [isCapturing, setIsCapturing] = useState(false);
  const [screenshotMessage, setScreenshotMessage] = useState(null);
  const [soundPlayRequest, setSoundPlayRequest] = useState(null);
  const [subtitle, setSubtitle] = useState(null);
  const [caption, setCaption] = useState(null);
  const messageTimerRef = useRef(null);
  const screenshotTimerRef = useRef(null);
  const subtitleTimerRef = useRef(null);
  const captionTimerRef = useRef(null);
  const captureFnRef = useRef(null);
  const requestQueueRef = useRef([]);
  const pendingRequestIdsRef = useRef(new Set());
  const isProcessingRef = useRef(false);
  const isCapturingRef = useRef(false);
  const queueTimerRef = useRef(null);
  const wsRef = useRef(null);
  const isMountedRef = useRef(true);
  const incubatorMode = (readParams().get("incubator") ?? "false") === "true";
  const soundPlayerEnabled = (readParams().get("sound_player") ?? "false") === "true";
  const iframeMode = !incubatorMode && (readParams().get("iframe_mode") ?? "false") === "true";
  const slideMode = !incubatorMode && !iframeMode && (readParams().get("slide_mode") ?? "false") === "true";
  const organicMode =
    !incubatorMode && !iframeMode && !slideMode && (readParams().get("organic_mode") ?? "false") === "true";
  const phylogenyMode =
    !incubatorMode && !iframeMode && !slideMode && !organicMode && (readParams().get("phylogeny") ?? "false") === "true";
  const searchMode =
    !incubatorMode && !iframeMode && !slideMode && !organicMode && !phylogenyMode &&
    (readParams().get("search_mode") ?? "false") === "true";
  const captionMode =
    !incubatorMode && !iframeMode && !slideMode && !organicMode && !phylogenyMode && !searchMode &&
    (readParams().get("caption_mode") ?? "false") === "true";
  const clientId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("client");
    if (fromQuery && fromQuery.trim()) return fromQuery.trim();
    const fromEnv = import.meta.env.VITE_CLIENT_ID;
    if (fromEnv && `${fromEnv}`.trim()) return `${fromEnv}`.trim();
    return "default";
  }, []);

  const iframeDefaultConfig = useMemo(
    () => ({
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
    }),
    [],
  );

  const initialIframeConfigFromParams = useMemo(
    () => sanitizeIframeConfig(parseIframeConfigFromParams(initialParams), iframeDefaultConfig),
    [initialParams, iframeDefaultConfig],
  );
  const [localIframeConfig, setLocalIframeConfig] = useState(initialIframeConfigFromParams);
  const [serverIframeConfig, setServerIframeConfig] = useState(null);
  const [iframeConfigError, setIframeConfigError] = useState(null);

  const updateQueryWithIframeConfig = useCallback((config) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const params = url.searchParams;

    // Always clean noisy iframe_* keys except the mode toggle itself when compact mode is on
    if (!PERSIST_IFRAME_QUERY) {
      const keysToDelete = [];
      params.forEach((_, key) => {
        if (key.startsWith("iframe_") && key !== "iframe_mode") {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach((key) => params.delete(key));
      window.history.replaceState(null, "", `${url.pathname}?${params.toString()}`);
      return;
    }

    if (!config) return;
    const reserved = new Set(["iframe_mode", "iframe_layout", "iframe_gap", "iframe_columns"]);
    const keysToDelete = [];
    params.forEach((_, key) => {
      if (key.startsWith("iframe_") && !reserved.has(key)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach((key) => params.delete(key));

    const entries = buildQueryFromIframeConfig(config);
    if (entries) {
      entries.forEach(([key, value]) => {
        params.set(key, value);
      });
    } else {
      params.delete("iframe_panels");
    }

    window.history.replaceState(null, "", `${url.pathname}?${params.toString()}`);
  }, []);

  const handleLocalIframeConfigApply = useCallback(
    (nextConfig) => {
      const sanitized = sanitizeIframeConfig(nextConfig, iframeDefaultConfig);
      setLocalIframeConfig(sanitized);
      updateQueryWithIframeConfig(sanitized);
    },
    [iframeDefaultConfig, updateQueryWithIframeConfig],
  );

  const clearSubtitleTimer = useCallback(() => {
    if (subtitleTimerRef.current) {
      clearTimeout(subtitleTimerRef.current);
      subtitleTimerRef.current = null;
    }
  }, []);

  const applySubtitle = useCallback(
    (payload) => {
      clearSubtitleTimer();
      if (!payload || typeof payload !== "object") {
        setSubtitle(null);
        return;
      }
      const textValue = "text" in payload ? String(payload.text ?? "") : "";
      if (!textValue.trim()) {
        setSubtitle(null);
        return;
      }
      const normalized = {
        text: textValue,
        language:
          typeof payload.language === "string" && payload.language.trim() ? payload.language.trim() : null,
        durationSeconds:
          typeof payload.duration_seconds === "number" &&
          Number.isFinite(payload.duration_seconds) &&
          payload.duration_seconds > 0
            ? payload.duration_seconds
            : null,
        expiresAt: typeof payload.expires_at === "string" ? payload.expires_at : null,
        updatedAt: typeof payload.updated_at === "string" ? payload.updated_at : null,
      };
      setSubtitle(normalized);
      let delayMs = null;
      if (normalized.expiresAt) {
        const expiresTs = Date.parse(normalized.expiresAt);
        if (!Number.isNaN(expiresTs)) {
          delayMs = Math.max(0, expiresTs - Date.now());
        }
      }
      if (delayMs === null && typeof normalized.durationSeconds === "number") {
        delayMs = normalized.durationSeconds * 1000;
      }
      if (delayMs !== null) {
        const expectedUpdatedAt = normalized.updatedAt;
        subtitleTimerRef.current = setTimeout(() => {
          setSubtitle((current) => {
            if (!current) return current;
            if (expectedUpdatedAt && current.updatedAt !== expectedUpdatedAt) {
              return current;
            }
            return null;
          });
          subtitleTimerRef.current = null;
        }, delayMs);
      }
    },
    [clearSubtitleTimer],
  );

  const clearCaptionTimer = useCallback(() => {
    if (captionTimerRef.current) {
      clearTimeout(captionTimerRef.current);
      captionTimerRef.current = null;
    }
  }, []);

  const applyCaption = useCallback(
    (payload) => {
      clearCaptionTimer();
      if (!payload || typeof payload !== "object") {
        setCaption(null);
        return;
      }
      const textValue = "text" in payload ? String(payload.text ?? "") : "";
      if (!textValue.trim()) {
        setCaption(null);
        return;
      }
      const normalized = {
        text: textValue,
        language:
          typeof payload.language === "string" && payload.language.trim() ? payload.language.trim() : null,
        durationSeconds:
          typeof payload.duration_seconds === "number" &&
          Number.isFinite(payload.duration_seconds) &&
          payload.duration_seconds > 0
            ? payload.duration_seconds
            : null,
        expiresAt: typeof payload.expires_at === "string" ? payload.expires_at : null,
        updatedAt: typeof payload.updated_at === "string" ? payload.updated_at : null,
      };
      setCaption(normalized);
      let delayMs = null;
      if (normalized.expiresAt) {
        const expiresTs = Date.parse(normalized.expiresAt);
        if (!Number.isNaN(expiresTs)) {
          delayMs = Math.max(0, expiresTs - Date.now());
        }
      }
      if (delayMs === null && typeof normalized.durationSeconds === "number") {
        delayMs = normalized.durationSeconds * 1000;
      }
      if (delayMs !== null) {
        const expectedUpdatedAt = normalized.updatedAt;
        captionTimerRef.current = setTimeout(() => {
          setCaption((current) => {
            if (!current) return current;
            if (expectedUpdatedAt && current.updatedAt !== expectedUpdatedAt) {
              return current;
            }
            return null;
          });
          captionTimerRef.current = null;
        }, delayMs);
      }
    },
    [clearCaptionTimer],
  );

  useEffect(() => {
    if (!iframeMode) {
      setServerIframeConfig(null);
      setIframeConfigError(null);
    }
  }, [iframeMode]);

  useEffect(() => {
    if (!iframeMode) return undefined;

    let cancelled = false;
    const controller = new AbortController();

    const loadConfig = async () => {
      try {
        let endpoint = "/api/iframe-config";
        if (clientId) {
          const qs = new URLSearchParams({ client: clientId });
          endpoint = `${endpoint}?${qs.toString()}`;
        }
        const response = await fetch(endpoint, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const json = await response.json();
        if (cancelled) return;
        const sanitized = sanitizeIframeConfig(json, iframeDefaultConfig);
        setServerIframeConfig(sanitized);
        setIframeConfigError(null);
        updateQueryWithIframeConfig(sanitized);
      } catch (error) {
        if (cancelled) return;
        console.error("取得 iframe 配置失敗", error);
        setIframeConfigError(error.message || String(error));
        setServerIframeConfig(null);
      }
    };

    loadConfig();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [iframeMode, iframeDefaultConfig, updateQueryWithIframeConfig, clientId]);

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

  useEffect(() => {
    let active = true;
    fetchSubtitleState(clientId)
      .then(({ subtitle: initialSubtitle }) => {
        if (!active) return;
        applySubtitle(initialSubtitle ?? null);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [applySubtitle, clientId]);

  useEffect(() => {
    let active = true;
    fetchCaptionState(clientId)
      .then(({ caption: initialCaption }) => {
        if (!active) return;
        applyCaption(initialCaption ?? null);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [applyCaption, clientId]);

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
      if (subtitleTimerRef.current) {
        clearTimeout(subtitleTimerRef.current);
        subtitleTimerRef.current = null;
      }
      if (queueTimerRef.current) {
        clearTimeout(queueTimerRef.current);
        queueTimerRef.current = null;
      }
      if (captionTimerRef.current) {
        clearTimeout(captionTimerRef.current);
        captionTimerRef.current = null;
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
    if (!imgId || organicMode || slideMode || iframeMode) return;
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
  }, [imgId, phylogenyMode, incubatorMode, organicMode, slideMode, iframeMode]);

  const navigateToImage = (nextImg) => {
    const params = readParams();
    params.set("img", nextImg);
    const qs = params.toString();
    window.history.replaceState(null, "", `?${qs}`);
    setImgId(nextImg);
  };

  // 自動向子代/兄弟/父母切換
  useEffect(() => {
    if (!data || organicMode || slideMode || iframeMode) return;
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
  }, [data, organicMode, slideMode, iframeMode]);

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
      const result = await uploadScreenshot(blob, requestId, clientId);
      const label =
        result?.relative_path || result?.filename || (requestId ? `request ${requestId}` : "已上傳");
      const prefix = isAuto ? "自動截圖完成" : "截圖完成";
      pushScreenshotMessage(`${prefix}：${label}`);
      return result;
    },
    [pushScreenshotMessage, clientId]
  );

  useEffect(() => {
    const captureScene = async () => {
      const captureFn = captureFnRef.current;
      if (!captureFn) {
        throw new Error("場景尚未準備好");
      }
      return captureFn();
    };
    window.__APP_CAPTURE_SCENE = captureScene;
    return () => {
      if (window.__APP_CAPTURE_SCENE === captureScene) {
        delete window.__APP_CAPTURE_SCENE;
      }
    };
  }, []);

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
            await reportScreenshotFailure(request.request_id, message, clientId);
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
  }, [reportScreenshotFailure, runCaptureInternal, pushScreenshotMessage, clientId]);

  const enqueueScreenshotRequest = useCallback(
    (payload) => {
      if (!payload || !payload.request_id) return;
      const targetClientId = payload?.target_client_id ?? payload?.metadata?.client_id ?? null;
      if (targetClientId && targetClientId !== clientId) {
        return;
      }
      const id = payload.request_id;
      if (pendingRequestIdsRef.current.has(id)) return;
      pendingRequestIdsRef.current.add(id);
      requestQueueRef.current.push(payload);
      const label = payload?.metadata?.label || payload?.metadata?.source || id;
      pushScreenshotMessage(`收到截圖請求：${label}`);
      processQueue();
    },
    [processQueue, pushScreenshotMessage, clientId]
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

      socket.onopen = () => {
        if (!active) return;
        const hello = {
          type: "hello",
          client_id: clientId,
        };
        try {
          socket.send(JSON.stringify(hello));
        } catch (err) {
          console.error("WebSocket hello 發送失敗", err);
        }
      };

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
        } else if (payload?.type === "sound_play") {
          if (payload?.filename) {
            setSoundPlayRequest({ filename: payload.filename, url: payload.url });
          }
        } else if (payload?.type === "subtitle_update") {
          const targetId = payload?.target_client_id;
          if (targetId && targetId !== clientId) {
            return;
          }
          applySubtitle(payload?.subtitle ?? null);
        } else if (payload?.type === "caption_update") {
          const targetId = payload?.target_client_id;
          if (targetId && targetId !== clientId) {
            return;
          }
          applyCaption(payload?.caption ?? null);
        } else if (payload?.type === "iframe_config" && payload?.config) {
          const targetId = payload?.target_client_id;
          if (targetId && targetId !== clientId) {
            return;
          }
          const sanitized = sanitizeIframeConfig(payload.config, iframeDefaultConfig);
          setServerIframeConfig(sanitized);
          setIframeConfigError(null);
          updateQueryWithIframeConfig(sanitized);
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
  }, [enqueueScreenshotRequest, clientId, iframeDefaultConfig, updateQueryWithIframeConfig, applySubtitle, applyCaption]);

  const subtitleOverlay = <SubtitleOverlay subtitle={subtitle} />;

  if (iframeMode) {
    const activeConfig = serverIframeConfig || localIframeConfig || iframeDefaultConfig;
    const controlsEnabled = !serverIframeConfig;
    return (
      <>
        <IframeMode
          config={activeConfig}
          controlsEnabled={controlsEnabled}
          onApplyConfig={controlsEnabled ? handleLocalIframeConfigApply : undefined}
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
        <SlideMode imagesBase={IMAGES_BASE} anchorImage={imgId} intervalMs={slideIntervalMs} />
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
