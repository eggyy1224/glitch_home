import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  createEpisode,
  createIframeTimeline,
  fetchEpisode,
  fetchIframeTimeline,
  getIframeSnapshot,
  restoreIframeSnapshot,
  saveIframeSnapshot,
  listEpisodes,
  listIframeSnapshots,
  listIframeTimelines,
  playEpisode,
  playIframeTimeline,
  updateEpisode as updateEpisodeApi,
  updateIframeTimeline,
} from "../api.js";
import { AdminPanelContext } from "../AdminPanelContext";
import {
  activeTabButtonStyle,
  boxStyle,
  columnsStyle,
  columnStyle,
  labelStyle,
  previewContainerStyle,
  previewTitleStyle,
  resizerHandleStyle,
  resizerHitboxStyle,
  snapshotPreviewIframeStyle,
  tabButtonStyle,
} from "../AdminPanelStyles.js";
import {
  defaultEpisodePayload,
  defaultTimelinePayload,
  firstSnapshotRef,
  minimalConfigPayload,
  parseTargetMap,
  previewSrcFromConfig,
  pretty,
  timelinePlaybackSrc,
} from "../adminPanelUtils.js";
import EpisodeListPanel from "./timeline/EpisodeListPanel";
import EpisodeTracksEditor from "./timeline/EpisodeTracksEditor";
import SnapshotPanelsEditor from "./snapshot/SnapshotPanelsEditor.jsx";
import TimelineListPanel from "./timeline/TimelineListPanel";
import TimelinePreviewPlayer from "./timeline/TimelinePreviewPlayer";
import TimelineStepsEditor from "./timeline/TimelineStepsEditor";

function validateTimeline(data) {
  const errors = [];
  if (!data || typeof data !== "object") {
    return [{ path: "root", message: "timeline 需要是物件" }];
  }
  if (!data.id) {
    errors.push({ path: "id", message: "缺少 timeline id" });
  }
  if (!Array.isArray(data.steps) || data.steps.length === 0) {
    errors.push({ path: "steps", message: "需要至少一個 step" });
  } else {
    data.steps.forEach((step, index) => {
      if (!step || typeof step !== "object") {
        errors.push({ path: `steps[${index}]`, message: "step 格式不正確" });
        return;
      }
      if (!step.snapshot) {
        errors.push({ path: `steps[${index}].snapshot`, message: "缺少 snapshot" });
      }
      if (step.duration === undefined || step.duration === null || Number(step.duration) <= 0) {
        errors.push({ path: `steps[${index}].duration`, message: "duration 必須大於 0" });
      }
    });
  }
  return errors;
}

function validateEpisode(data) {
  const errors = [];
  if (!data || typeof data !== "object") {
    return [{ path: "root", message: "episode 需要是物件" }];
  }
  if (!data.id) {
    errors.push({ path: "id", message: "缺少 episode id" });
  }
  if (!Array.isArray(data.tracks) || data.tracks.length === 0) {
    errors.push({ path: "tracks", message: "需要至少一條 track" });
  } else {
    data.tracks.forEach((track, index) => {
      if (!track.timelineId && !track.timeline_id) {
        errors.push({ path: `tracks[${index}].timelineId`, message: "缺少 timelineId" });
      }
      const target = track.targetClientId || track.target_client_id;
      if (!target) {
        errors.push({ path: `tracks[${index}].targetClientId`, message: "缺少 target client" });
      }
    });
  }
  return errors;
}

function validateSnapshot(data) {
  const errors = [];
  if (!data || typeof data !== "object") {
    return [{ path: "root", message: "snapshot 需要是物件" }];
  }
  if (!Array.isArray(data.panels) || data.panels.length === 0) {
    errors.push({ path: "panels", message: "需要至少一個 panel" });
  } else {
    data.panels.forEach((panel, index) => {
      if (!panel || typeof panel !== "object") {
        errors.push({ path: `panels[${index}]`, message: "panel 格式不正確" });
        return;
      }
      const hasUrl = typeof panel.url === "string" && panel.url.trim();
      const hasImage = typeof panel.image === "string" && panel.image.trim();
      if (!hasUrl && !hasImage) {
        errors.push({ path: `panels[${index}]`, message: "需要 url 或 image" });
      }
      if (panel.ratio !== undefined && Number(panel.ratio) <= 0) {
        errors.push({ path: `panels[${index}].ratio`, message: "ratio 必須大於 0" });
      }
    });
  }
  return errors;
}

function formatTs(ts) {
  if (!ts) return "";
  const date = typeof ts === "string" ? new Date(ts) : ts;
  return date.toLocaleString();
}

function toggleIndex(selected, index) {
  if (selected.includes(index)) return selected.filter((i) => i !== index);
  return [...selected, index];
}

function snapshotValueForSelect(step, timeline, fallbackClient) {
  if (!step || !step.snapshot) return "";
  const ref = String(step.snapshot).trim();
  if (!ref) return "";
  if (ref.includes("/")) return ref;
  const client =
    step.clientId || step.client_id || timeline?.clientId || timeline?.client_id || fallbackClient || "";
  return client ? `${client}/${ref}` : ref;
}

export default function TimelineEpisodeEditor() {
  const { defaultClientId } = useContext(AdminPanelContext);
  const [mode, setMode] = useState("timeline");
  const [timelineData, setTimelineData] = useState(() => defaultTimelinePayload(defaultClientId));
  const [episodeData, setEpisodeData] = useState(() => defaultEpisodePayload(defaultClientId));
  const [snapshotData, setSnapshotData] = useState(() => minimalConfigPayload(defaultClientId));
  const [jsonText, setJsonText] = useState(() => pretty(defaultTimelinePayload(defaultClientId)));
  const [jsonLocked, setJsonLocked] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [message, setMessage] = useState("");
  const [timelineList, setTimelineList] = useState([]);
  const [episodeList, setEpisodeList] = useState([]);
  const [timelineFilter, setTimelineFilter] = useState("");
  const [episodeFilter, setEpisodeFilter] = useState("");
  const [snapshotClient, setSnapshotClient] = useState(defaultClientId);
  const [snapshotKeyword, setSnapshotKeyword] = useState("");
  const [snapshotName, setSnapshotName] = useState("new_snapshot");
  const [snapshotOptions, setSnapshotOptions] = useState([]);
  const [snapshotMessage, setSnapshotMessage] = useState("");
  const [selectedRows, setSelectedRows] = useState([]);
  const [clipboard, setClipboard] = useState(null);
  const [batchDuration, setBatchDuration] = useState("");
  const [batchTargetClient, setBatchTargetClient] = useState("");
  const [timelinePreviewSrc, setTimelinePreviewSrc] = useState(null);
  const [timelinePreviewError, setTimelinePreviewError] = useState(null);
  const [timelinePlaySrc, setTimelinePlaySrc] = useState(null);
  const [timelinePlayError, setTimelinePlayError] = useState(null);
  const [snapshotPreviewSrc, setSnapshotPreviewSrc] = useState(null);
  const [snapshotPreviewError, setSnapshotPreviewError] = useState(null);
  const [snapshotPreviewWidth, setSnapshotPreviewWidth] = useState(() => {
    if (typeof window === "undefined") return 960;
    return Math.max(Math.min(window.innerWidth - 100, 1200), 720);
  });
  const [episodeTargetOverride, setEpisodeTargetOverride] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const activeData = useMemo(
    () => (mode === "timeline" ? timelineData : mode === "episode" ? episodeData : snapshotData),
    [episodeData, mode, snapshotData, timelineData],
  );
  const snapshotFrameHeight = useMemo(
    () => Math.max(320, Math.round((snapshotPreviewWidth * 9) / 16)),
    [snapshotPreviewWidth],
  );

  const syncJsonFromData = useCallback(
    (data) => {
      if (jsonLocked) return;
      setJsonText(pretty(data));
      setLastSyncAt(new Date());
    },
    [jsonLocked],
  );

  const updateTimeline = useCallback(
    (next, { markDirty = true } = {}) => {
      setTimelineData(next);
      syncJsonFromData(next);
      setDirty(Boolean(markDirty));
      setValidationErrors(validateTimeline(next));
    },
    [syncJsonFromData],
  );

  const setEpisodeState = useCallback(
    (next, { markDirty = true } = {}) => {
      setEpisodeData((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        syncJsonFromData(resolved);
        setDirty(Boolean(markDirty));
        setValidationErrors(validateEpisode(resolved));
        return resolved;
      });
    },
    [syncJsonFromData],
  );

  const updateSnapshot = useCallback(
    (next, { markDirty = true } = {}) => {
      setSnapshotData(next);
      syncJsonFromData(next);
      setDirty(Boolean(markDirty));
      setValidationErrors(validateSnapshot(next));
    },
    [syncJsonFromData],
  );

  const handleModeChange = useCallback(
    (nextMode) => {
      setMode(nextMode);
      setSelectedRows([]);
      setTimelinePlaySrc(null);
      setTimelinePlayError(null);
      if (nextMode === "timeline") {
        setValidationErrors(validateTimeline(timelineData));
        syncJsonFromData(timelineData);
      } else if (nextMode === "episode") {
        setValidationErrors(validateEpisode(episodeData));
        syncJsonFromData(episodeData);
      } else {
        setValidationErrors(validateSnapshot(snapshotData));
        syncJsonFromData(snapshotData);
      }
    },
    [episodeData, snapshotData, syncJsonFromData, timelineData],
  );

  const refreshTimelines = useCallback(async () => {
    try {
      const data = await listIframeTimelines(timelineFilter || null);
      setTimelineList(Array.isArray(data.timelines) ? data.timelines : []);
      setMessage(`已載入 ${data.timelines?.length ?? 0} 筆 timeline`);
    } catch (err) {
      setMessage(err.message || "載入 timeline 失敗");
    }
  }, [timelineFilter]);

  const refreshEpisodes = useCallback(async () => {
    try {
      const data = await listEpisodes();
      const list = Array.isArray(data.episodes) ? data.episodes : [];
      const filtered = episodeFilter ? list.filter((e) => `${e.id}`.includes(episodeFilter)) : list;
      setEpisodeList(filtered);
      setMessage(`已載入 ${filtered.length} 筆 episode`);
    } catch (err) {
      setMessage(err.message || "載入 episode 失敗");
    }
  }, [episodeFilter]);

  const refreshSnapshots = useCallback(async (clientOverride) => {
    try {
      const targetClient = clientOverride ?? snapshotClient;
      const data = await listIframeSnapshots(targetClient || null);
      const list = Array.isArray(data.snapshots) ? data.snapshots : [];
      const filtered = snapshotKeyword
        ? list.filter((item) => `${item.id || item.name}`.includes(snapshotKeyword) || `${item.client}`.includes(snapshotKeyword))
        : list;
      const normalized = filtered.map((item) => ({
        ...item,
        client: item.client || item.client_id || targetClient || timelineData.clientId || timelineData.client_id || "",
      }));
      setSnapshotOptions(normalized);
      setSnapshotMessage(`取得 ${filtered.length} 筆 snapshot`);
    } catch (err) {
      setSnapshotMessage(err.message || "載入 snapshot 清單失敗");
    }
  }, [snapshotClient, snapshotKeyword, timelineData.clientId, timelineData.client_id]);

  const handleLoadSelected = useCallback(
    async (id) => {
      if (!id) return;
      try {
        if (mode === "timeline") {
          const data = await fetchIframeTimeline(id, { resolve: false });
          const payload = data.timeline || data;
          updateTimeline(payload, { markDirty: false });
          if (payload.clientId || payload.client_id) {
            const nextClient = payload.clientId || payload.client_id;
            setSnapshotClient(nextClient);
            await refreshSnapshots(nextClient);
          }
          setMessage(`已載入 timeline ${id}`);
        } else {
          const data = await fetchEpisode(id, { resolve: false });
          const payload = data.episode || data;
          setEpisodeState(payload, { markDirty: false });
          setMessage(`已載入 episode ${id}`);
        }
        setDirty(false);
      } catch (err) {
        setMessage(err.message || "載入失敗");
      }
    },
    [mode, refreshSnapshots, setEpisodeState, updateTimeline],
  );

  const handleLoadSnapshot = useCallback(
    async (name, clientOverride) => {
      const targetClient = clientOverride ?? snapshotClient;
      if (!targetClient) {
        setMessage("請先設定 client 再載入 snapshot");
        return;
      }
      if (!name) return;
      try {
        const data = await getIframeSnapshot(targetClient, name);
        const raw = data.raw || data.snapshot || data;
        const resolvedClient = targetClient || data.client_id || data.client;
        setSnapshotClient(resolvedClient || targetClient);
        setSnapshotName(name);
        updateSnapshot(raw, { markDirty: false });
        const src = previewSrcFromConfig(raw);
        setSnapshotPreviewSrc(src);
        setSnapshotPreviewError(src ? null : "預覽來源不足");
        await refreshSnapshots(resolvedClient || targetClient);
        setMessage(`已載入 snapshot ${resolvedClient || targetClient}/${name}`);
        setDirty(false);
      } catch (err) {
        setMessage(err.message || "載入 snapshot 失敗");
      }
    },
    [refreshSnapshots, snapshotClient, updateSnapshot],
  );

  const clampSnapshotPreviewWidth = useCallback((width) => {
    const max = typeof window !== "undefined" ? Math.max(window.innerWidth - 60, 640) : 1400;
    return Math.min(Math.max(width, 560), Math.min(max, 1800));
  }, []);

  const startSnapshotResize = useCallback(
    (event) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = snapshotPreviewWidth;
      const onMove = (e) => {
        const delta = e.clientX - startX;
        setSnapshotPreviewWidth(clampSnapshotPreviewWidth(startWidth + delta));
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [clampSnapshotPreviewWidth, snapshotPreviewWidth],
  );

  const handleSave = useCallback(async () => {
    try {
      setIsSaving(true);
      if (mode === "timeline") {
        const payload = timelineData;
        const targetId = (payload.id || "").trim();
        if (!targetId) throw new Error("timeline id 必填");
        const normalizedPayload = { ...payload, id: targetId };
        updateTimeline(normalizedPayload);
        let action = "update";
        try {
          await updateIframeTimeline(targetId, normalizedPayload, { resolve: false });
        } catch (err) {
          const msg = err?.message || "";
          if (msg.includes("404")) {
            action = "create";
            await createIframeTimeline(normalizedPayload, { resolve: false });
          } else {
            throw err;
          }
        }
        setMessage(`${action === "update" ? "已更新" : "已建立"} timeline ${targetId}`);
        await refreshTimelines();
      } else if (mode === "episode") {
        const payload = episodeData;
        const targetId = (payload.id || "").trim();
        if (!targetId) throw new Error("episode id 必填");
        const normalizedPayload = { ...payload, id: targetId };
        setEpisodeState(normalizedPayload);
        let action = "update";
        try {
          await updateEpisodeApi(targetId, normalizedPayload, { resolve: false });
        } catch (err) {
          const msg = err?.message || "";
          if (msg.includes("404")) {
            action = "create";
            await createEpisode(normalizedPayload, { resolve: false });
          } else {
            throw err;
          }
        }
        setMessage(`${action === "update" ? "已更新" : "已建立"} episode ${targetId}`);
        await refreshEpisodes();
      } else {
        const payload = snapshotData;
        const client = (snapshotClient || defaultClientId || "").trim();
        const name = (snapshotName || "").trim();
        if (!client) throw new Error("client 必填");
        if (!name) throw new Error("snapshot 名稱必填");
        const errors = validateSnapshot(payload);
        if (errors.length) {
          const first = errors[0];
          throw new Error(`驗證錯誤：${first.path} ${first.message}`);
        }
        updateSnapshot(payload);
        await saveIframeSnapshot(client, name, payload);
        setSnapshotName(name);
        setMessage(`已儲存 snapshot ${client}/${name}`);
        await refreshSnapshots(client);
      }
      setDirty(false);
      return true;
    } catch (err) {
      setMessage(err.message || "儲存失敗");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [
    defaultClientId,
    episodeData,
    mode,
    refreshEpisodes,
    refreshSnapshots,
    refreshTimelines,
    setEpisodeState,
    snapshotClient,
    snapshotData,
    snapshotName,
    timelineData,
    updateSnapshot,
    updateTimeline,
  ]);

  const handleJsonChange = useCallback((text) => {
    setJsonText(text);
    setDirty(true);
  }, []);

  useEffect(() => {
    if (jsonLocked) return undefined;
    const handle = setTimeout(() => {
      try {
        const parsed = JSON.parse(jsonText);
        if (mode === "timeline") {
          setTimelineData(parsed);
          setValidationErrors(validateTimeline(parsed));
        } else if (mode === "episode") {
          setEpisodeData(parsed);
          setValidationErrors(validateEpisode(parsed));
        } else {
          setSnapshotData(parsed);
          setValidationErrors(validateSnapshot(parsed));
        }
        setLastSyncAt(new Date());
      } catch (err) {
        setValidationErrors([{ path: "json", message: err.message || "JSON 解析失敗" }]);
      }
    }, 500);
    return () => clearTimeout(handle);
  }, [jsonLocked, jsonText, mode]);

  useEffect(() => {
    const nextTimeline = defaultTimelinePayload(defaultClientId);
    const nextEpisode = defaultEpisodePayload(defaultClientId);
    const nextSnapshot = minimalConfigPayload(defaultClientId);
    setTimelineData(nextTimeline);
    setEpisodeData(nextEpisode);
    setSnapshotData(nextSnapshot);
    setSnapshotClient(defaultClientId);
    setSnapshotName("new_snapshot");
    if (mode === "timeline") {
      setJsonText(pretty(nextTimeline));
      setValidationErrors(validateTimeline(nextTimeline));
    } else if (mode === "episode") {
      setJsonText(pretty(nextEpisode));
      setValidationErrors(validateEpisode(nextEpisode));
    } else {
      setJsonText(pretty(nextSnapshot));
      setValidationErrors(validateSnapshot(nextSnapshot));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在 defaultClientId 變更時重置，避免切換模式時清空編輯中的資料
  }, [defaultClientId]);

  useEffect(() => {
    refreshTimelines();
    refreshEpisodes();
    refreshSnapshots();
  }, [refreshEpisodes, refreshSnapshots, refreshTimelines]);

  useEffect(() => {
    if (mode !== "episode") return;
    if (!timelineList.length) return;
    if (dirty) return;
    setEpisodeState(
      (prev) => {
        if (!prev || !Array.isArray(prev.tracks) || prev.tracks.length === 0) return prev;
        const timelineIds = new Set(timelineList.map((t) => t.id));
        let changed = false;
        const nextTracks = prev.tracks.map((track) => {
          if (!track) return track;
          const currentId = track.timelineId || track.timeline_id || "";
          if (currentId && timelineIds.has(currentId)) return track;
          const targetClient = track.targetClientId || track.target_client_id || "";
          const candidate =
            timelineList.find((item) => (item.client_id || item.clientId || item.client) === targetClient) ||
            timelineList[0];
          if (!candidate) return track;
          changed = true;
          return { ...track, timelineId: candidate.id };
        });
        return changed ? { ...prev, tracks: nextTracks } : prev;
      },
      { markDirty: false },
    );
  }, [dirty, mode, setEpisodeState, timelineList]);

  useEffect(() => {
    if (mode !== "timeline") return undefined;
    let cancelled = false;
    const controller = new AbortController();
    const fetchPreview = async () => {
      try {
        const first = firstSnapshotRef(timelineData);
        if (!first) {
          setTimelinePreviewSrc(null);
          setTimelinePreviewError("無 snapshot 可預覽");
          return;
        }
        const snapshot = await getIframeSnapshot(first.client, first.name, { signal: controller.signal });
        if (cancelled) return;
        const raw = snapshot.raw || snapshot.snapshot || snapshot;
        const src = previewSrcFromConfig(raw);
        setTimelinePreviewError(src ? null : "預覽來源不足");
        setTimelinePreviewSrc(src);
      } catch (err) {
        if (cancelled || err?.name === "AbortError") return;
        setTimelinePreviewError(err.message || "預覽取得失敗");
        setTimelinePreviewSrc(null);
      }
    };
    void fetchPreview();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [mode, timelineData]);

  useEffect(() => {
    if (mode !== "snapshot") return;
    try {
      const src = previewSrcFromConfig(snapshotData);
      setSnapshotPreviewSrc(src);
      setSnapshotPreviewError(src ? null : "預覽來源不足");
    } catch (err) {
      setSnapshotPreviewSrc(null);
      setSnapshotPreviewError(err.message || "預覽取得失敗");
    }
  }, [mode, snapshotData]);

  const handleStepChange = useCallback(
    (index, patch) => {
      updateTimeline({
        ...timelineData,
        steps: timelineData.steps.map((step, i) => (i === index ? { ...step, ...patch } : step)),
      });
    },
    [timelineData, updateTimeline],
  );

  const handleTrackChange = useCallback(
    (index, patch) => {
      setEpisodeState({
        ...episodeData,
        tracks: episodeData.tracks.map((track, i) => (i === index ? { ...track, ...patch } : track)),
      });
    },
    [episodeData, setEpisodeState],
  );

  const addStep = useCallback(() => {
    updateTimeline({
      ...timelineData,
      steps: [...(timelineData.steps || []), { snapshot: `${defaultClientId}/snapshot_x`, duration: 5, label: "新步驟" }],
    });
  }, [defaultClientId, timelineData, updateTimeline]);

  const addTrack = useCallback(() => {
    const fallbackTimeline =
      timelineList.find((item) => (item.client_id || item.clientId || item.client) === defaultClientId) ||
      timelineList[0];
    setEpisodeState({
      ...episodeData,
      tracks: [
        ...(episodeData.tracks || []),
        { timelineId: fallbackTimeline?.id || "", targetClientId: defaultClientId, offset: 0 },
      ],
    });
  }, [defaultClientId, episodeData, setEpisodeState, timelineList]);

  const addPanel = useCallback(() => {
    const nextPanels = [...(snapshotData.panels || [])];
    const idBase = `panel_${nextPanels.length + 1}`;
    nextPanels.push({ id: idBase, url: "/", ratio: 1 });
    updateSnapshot({ ...snapshotData, panels: nextPanels });
  }, [snapshotData, updateSnapshot]);

  const handlePanelChange = useCallback(
    (index, patch) => {
      updateSnapshot({
        ...snapshotData,
        panels: (snapshotData.panels || []).map((panel, i) => (i === index ? { ...panel, ...patch } : panel)),
      });
    },
    [snapshotData, updateSnapshot],
  );

  const moveRow = useCallback(
    (index, delta) => {
      if (mode === "timeline") {
        const steps = [...(timelineData.steps || [])];
        const target = index + delta;
        if (target < 0 || target >= steps.length) return;
        const [item] = steps.splice(index, 1);
        steps.splice(target, 0, item);
        updateTimeline({ ...timelineData, steps });
      } else if (mode === "episode") {
        const tracks = [...(episodeData.tracks || [])];
        const target = index + delta;
        if (target < 0 || target >= tracks.length) return;
        const [item] = tracks.splice(index, 1);
        tracks.splice(target, 0, item);
        setEpisodeState({ ...episodeData, tracks });
      } else {
        const panels = [...(snapshotData.panels || [])];
        const target = index + delta;
        if (target < 0 || target >= panels.length) return;
        const [item] = panels.splice(index, 1);
        panels.splice(target, 0, item);
        updateSnapshot({ ...snapshotData, panels });
      }
    },
    [episodeData, mode, snapshotData, timelineData, setEpisodeState, updateSnapshot, updateTimeline],
  );

  const removeRow = useCallback(
    (index) => {
      if (mode === "timeline") {
        updateTimeline({ ...timelineData, steps: timelineData.steps.filter((_, i) => i !== index) });
      } else if (mode === "episode") {
        setEpisodeState({ ...episodeData, tracks: episodeData.tracks.filter((_, i) => i !== index) });
      } else {
        updateSnapshot({ ...snapshotData, panels: (snapshotData.panels || []).filter((_, i) => i !== index) });
      }
      setSelectedRows((prev) => prev.filter((i) => i !== index));
    },
    [episodeData, mode, setEpisodeState, snapshotData, timelineData, updateSnapshot, updateTimeline],
  );

  const duplicateRow = useCallback(
    (index) => {
      if (mode === "timeline") {
        const steps = [...(timelineData.steps || [])];
        const target = steps[index];
        steps.splice(index + 1, 0, { ...target });
        updateTimeline({ ...timelineData, steps });
      } else if (mode === "episode") {
        const tracks = [...(episodeData.tracks || [])];
        const target = tracks[index];
        tracks.splice(index + 1, 0, { ...target });
        setEpisodeState({ ...episodeData, tracks });
      } else {
        const panels = [...(snapshotData.panels || [])];
        const target = panels[index];
        panels.splice(index + 1, 0, { ...target });
        updateSnapshot({ ...snapshotData, panels });
      }
    },
    [episodeData, mode, setEpisodeState, snapshotData, timelineData, updateSnapshot, updateTimeline],
  );

  const handleCopy = useCallback(() => {
    if (!selectedRows.length) return;
    const items = selectedRows
      .map((idx) =>
        mode === "timeline"
          ? timelineData.steps[idx]
          : mode === "episode"
            ? episodeData.tracks[idx]
            : snapshotData.panels[idx],
      )
      .filter(Boolean);
    setClipboard({ mode, items });
    setMessage(`已複製 ${items.length} 筆`);
  }, [episodeData.tracks, mode, selectedRows, snapshotData.panels, timelineData.steps]);

  const handlePaste = useCallback(() => {
    if (!clipboard || clipboard.mode !== mode || !clipboard.items?.length) return;
    if (mode === "timeline") {
      updateTimeline({
        ...timelineData,
        steps: [...(timelineData.steps || []), ...clipboard.items.map((item) => ({ ...item }))],
      });
    } else if (mode === "episode") {
      setEpisodeState({
        ...episodeData,
        tracks: [...(episodeData.tracks || []), ...clipboard.items.map((item) => ({ ...item }))],
      });
    } else {
      updateSnapshot({
        ...snapshotData,
        panels: [...(snapshotData.panels || []), ...clipboard.items.map((item) => ({ ...item }))],
      });
    }
    setMessage(`已貼上 ${clipboard.items.length} 筆`);
  }, [clipboard, episodeData, mode, setEpisodeState, snapshotData, timelineData, updateSnapshot, updateTimeline]);

  const handleBatchApply = useCallback(() => {
    if (!selectedRows.length) return;
    if (mode === "timeline" && batchDuration) {
      updateTimeline({
        ...timelineData,
        steps: timelineData.steps.map((step, idx) =>
          selectedRows.includes(idx) ? { ...step, duration: Number(batchDuration) } : step,
        ),
      });
    }
    if (mode === "episode" && batchTargetClient) {
      setEpisodeState({
        ...episodeData,
        tracks: episodeData.tracks.map((track, idx) =>
          selectedRows.includes(idx) ? { ...track, targetClientId: batchTargetClient } : track,
        ),
      });
    }
  }, [batchDuration, batchTargetClient, episodeData, mode, selectedRows, setEpisodeState, timelineData, updateTimeline]);

  const handlePlayPreview = useCallback(async () => {
    if (mode !== "timeline") return;
    const id = timelineData.id;
    if (!id) {
      setTimelinePlayError("請先設定 id");
      return;
    }
    if (dirty) {
      const ok = await handleSave();
      if (!ok) {
        setTimelinePlayError("儲存失敗，無法預覽");
        return;
      }
    }
    setTimelinePlayError(null);
    setTimelinePlaySrc(timelinePlaybackSrc(id));
  }, [dirty, handleSave, mode, timelineData.id]);

  const handlePlayTimelineToClient = useCallback(async () => {
    if (mode !== "timeline") return;
    const id = timelineData.id;
    if (!id) {
      setMessage("請先設定 timeline id");
      return;
    }
    try {
      await playIframeTimeline(id, {}, { targetClientId: timelineData.clientId || timelineData.client_id });
      setMessage("已送出 timeline 播放");
    } catch (err) {
      setMessage(err.message || "播放失敗");
    }
  }, [mode, timelineData.clientId, timelineData.client_id, timelineData.id]);

  const handlePlayEpisode = useCallback(async () => {
    if (mode !== "episode") return;
    const id = episodeData.id;
    if (!id) {
      setMessage("請先設定 episode id");
      return;
    }
    const payload = {};
    const map = parseTargetMap(episodeTargetOverride);
    if (map && Object.keys(map).length > 0) {
      payload.target_client_map = map;
    }
    try {
      await playEpisode(id, payload);
      setMessage("已送出 episode 播放");
    } catch (err) {
      setMessage(err.message || "播放失敗");
    }
  }, [episodeData.id, episodeTargetOverride, mode]);

  const handlePlaySnapshot = useCallback(async () => {
    if (mode !== "snapshot") return;
    const client = (snapshotClient || "").trim();
    const name = (snapshotName || "").trim();
    if (!client || !name) {
      setMessage("請先設定 client 與 snapshot 名稱");
      return;
    }
    if (dirty) {
      const ok = await handleSave();
      if (!ok) {
        setMessage("儲存失敗，無法播放");
        return;
      }
    }
    try {
      setMessage(`播放中 ${name} → ${client}...`);
      await restoreIframeSnapshot(client, name);
      setMessage(`已送出 snapshot 到 ${client}`);
    } catch (err) {
      setMessage(err.message || "播放失敗");
    }
  }, [dirty, handleSave, mode, snapshotClient, snapshotName]);

  const canTimelinePaste = Boolean(clipboard && clipboard.mode === "timeline");
  const canEpisodePaste = Boolean(clipboard && clipboard.mode === "episode");
  const canSnapshotPaste = Boolean(clipboard && clipboard.mode === "snapshot");

  return (
    <div style={boxStyle} data-ai-id="admin.timeline-episode-editor" data-ai-section="admin.timeline-episode-editor">
      <div
        style={{ marginBottom: 8, display: "flex", gap: 8, flexWrap: "wrap" }}
        role="tablist"
        aria-label="Snapshot / Timeline / Episode 模式選擇"
        data-ai-id="timeline-episode.mode-switch"
      >
        <button
          type="button"
          onClick={() => handleModeChange("snapshot")}
          style={mode === "snapshot" ? activeTabButtonStyle : tabButtonStyle}
          role="tab"
          aria-selected={mode === "snapshot"}
          aria-controls="admin-editor-panel"
          id="snapshot-editor-tab"
          data-ai-action="timeline-episode.switch-snapshot"
        >
          Snapshot 模式
        </button>
        <button
          type="button"
          onClick={() => handleModeChange("timeline")}
          style={mode === "timeline" ? activeTabButtonStyle : tabButtonStyle}
          role="tab"
          aria-selected={mode === "timeline"}
          aria-controls="admin-editor-panel"
          id="timeline-editor-tab"
          data-ai-action="timeline-episode.switch-timeline"
        >
          Timeline 模式
        </button>
        <button
          type="button"
          onClick={() => handleModeChange("episode")}
          style={mode === "episode" ? activeTabButtonStyle : tabButtonStyle}
          role="tab"
          aria-selected={mode === "episode"}
          aria-controls="admin-editor-panel"
          id="episode-editor-tab"
          data-ai-action="timeline-episode.switch-episode"
        >
          Episode 模式
        </button>
        <span style={{ color: dirty ? "#ff6b6b" : "#82dca5", letterSpacing: "0.03em" }} data-ai-status="timeline-episode.dirty">
          {dirty ? "未保存變更" : "已同步"}
        </span>
        <span style={{ color: "#82dca5" }} data-ai-status="timeline-episode.last-sync">
          最後同步：{formatTs(lastSyncAt) || "--"}
        </span>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            checked={jsonLocked}
            onChange={(e) => setJsonLocked(e.target.checked)}
            aria-label="鎖定 JSON"
            data-ai-field="timeline-episode.json-lock"
          />
          鎖定 JSON 同步
        </label>
      </div>

      <div style={columnsStyle}>
        <div
          style={columnStyle}
          role="tabpanel"
          aria-labelledby={
            mode === "timeline" ? "timeline-editor-tab" : mode === "episode" ? "episode-editor-tab" : "snapshot-editor-tab"
          }
          id="admin-editor-panel"
          data-ai-section={
            mode === "timeline" ? "timeline.editor" : mode === "episode" ? "episode.editor" : "snapshot.editor"
          }
        >
          {mode === "snapshot" ? (
            <div data-ai-section="snapshot.editor.left">
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                <label style={labelStyle} htmlFor="snapshot-client">
                  Client
                </label>
                <input
                  id="snapshot-client"
                  type="text"
                  value={snapshotClient || ""}
                  onChange={(e) => setSnapshotClient(e.target.value)}
                  style={{ width: 140 }}
                  data-ai-field="snapshot.editor.client"
                />
                <label style={labelStyle} htmlFor="snapshot-name">
                  名稱
                </label>
                <input
                  id="snapshot-name"
                  type="text"
                  value={snapshotName}
                  onChange={(e) => setSnapshotName(e.target.value)}
                  style={{ width: 160 }}
                  data-ai-field="snapshot.editor.name"
                />
                <input
                  type="text"
                  placeholder="關鍵字"
                  value={snapshotKeyword}
                  onChange={(e) => setSnapshotKeyword(e.target.value)}
                  style={{ width: 140 }}
                  data-ai-field="snapshot.editor.keyword"
                />
                <button type="button" onClick={() => refreshSnapshots(snapshotClient)} data-ai-action="snapshot.editor.reload">
                  重新載入
                </button>
                <button type="button" onClick={() => handleLoadSnapshot(snapshotName)} data-ai-action="snapshot.editor.load">
                  載入
                </button>
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ marginBottom: 4 }}>Snapshot 列表（{snapshotMessage || "尚未載入"}）</div>
                <ul
                  role="list"
                  data-ai-id="snapshot.editor.list"
                  style={{
                    maxHeight: 180,
                    overflowY: "auto",
                    border: "1px solid #0f4",
                    padding: 8,
                    listStyle: "none",
                    margin: 0,
                    background: "#000",
                  }}
                >
                  {snapshotOptions.length === 0 && (
                    <li style={{ color: "#82dca5" }} data-ai-state="empty">
                      尚無資料
                    </li>
                  )}
                  {snapshotOptions.map((item) => (
                    <li
                      key={`${item.client}/${item.name || item.id}`}
                      style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}
                      data-ai-item={`snapshot:${item.name || item.id}`}
                    >
                      <span style={{ flex: 1 }}>
                        {item.client}/{item.name || item.id} {item.created_at ? `（${formatTs(item.created_at)}）` : ""}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSnapshotName(item.name || item.id);
                          setSnapshotClient(item.client);
                          handleLoadSnapshot(item.name || item.id, item.client);
                        }}
                        data-ai-action="snapshot.editor.load-item"
                      >
                        載入
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, marginBottom: 10 }}>
                <label style={{ display: "flex", flexDirection: "column" }}>
                  layout
                  <select
                    value={snapshotData.layout || "grid"}
                    onChange={(e) => updateSnapshot({ ...snapshotData, layout: e.target.value })}
                    data-ai-field="snapshot.editor.layout"
                  >
                    <option value="grid">grid</option>
                    <option value="horizontal">horizontal</option>
                    <option value="vertical">vertical</option>
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column" }}>
                  gap
                  <input
                    type="number"
                    min="0"
                    value={snapshotData.gap ?? 0}
                    onChange={(e) => updateSnapshot({ ...snapshotData, gap: Number(e.target.value) })}
                    data-ai-field="snapshot.editor.gap"
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column" }}>
                  columns
                  <input
                    type="number"
                    min="1"
                    value={snapshotData.columns ?? 1}
                    onChange={(e) => updateSnapshot({ ...snapshotData, columns: Number(e.target.value) })}
                    data-ai-field="snapshot.editor.columns"
                  />
                </label>
              </div>

              <SnapshotPanelsEditor
                panels={snapshotData.panels}
                selectedRows={selectedRows}
                onToggleRow={(index) => setSelectedRows((prev) => toggleIndex(prev, index))}
                onMoveRow={moveRow}
                onDuplicateRow={duplicateRow}
                onRemoveRow={removeRow}
                onAddPanel={addPanel}
                onCopy={handleCopy}
                onPaste={handlePaste}
                canPaste={canSnapshotPaste}
                onPanelChange={handlePanelChange}
              />
            </div>
          ) : (
            <>
              {mode === "timeline" ? (
                <TimelineListPanel
                  filter={timelineFilter}
                  onFilterChange={setTimelineFilter}
                  onReload={refreshTimelines}
                  timelines={timelineList}
                  onSelect={handleLoadSelected}
                />
              ) : (
                <EpisodeListPanel
                  filter={episodeFilter}
                  onFilterChange={setEpisodeFilter}
                  onReload={refreshEpisodes}
                  episodes={episodeList}
                  onSelect={handleLoadSelected}
                />
              )}

              {mode === "timeline" ? (
                <TimelineStepsEditor
                  steps={timelineData.steps}
                  selectedRows={selectedRows}
                  onToggleRow={(index) => setSelectedRows((prev) => toggleIndex(prev, index))}
                  onMoveRow={moveRow}
                  onDuplicateRow={duplicateRow}
                  onRemoveRow={removeRow}
                  onAddStep={addStep}
                  onCopy={handleCopy}
                  onPaste={handlePaste}
                  canPaste={canTimelinePaste}
                  batchDuration={batchDuration}
                  onBatchDurationChange={setBatchDuration}
                  onBatchApply={handleBatchApply}
                  snapshotClient={snapshotClient}
                  snapshotKeyword={snapshotKeyword}
                  onSnapshotClientChange={setSnapshotClient}
                  onSnapshotKeywordChange={setSnapshotKeyword}
                  onRefreshSnapshots={refreshSnapshots}
                  snapshotMessage={snapshotMessage}
                  snapshotOptions={snapshotOptions}
                  onStepChange={handleStepChange}
                  getSnapshotValue={(step) => snapshotValueForSelect(step, timelineData, snapshotClient)}
                />
              ) : (
                <EpisodeTracksEditor
                  tracks={episodeData.tracks}
                  selectedRows={selectedRows}
                  onToggleRow={(index) => setSelectedRows((prev) => toggleIndex(prev, index))}
                  onMoveRow={moveRow}
                  onDuplicateRow={duplicateRow}
                  onRemoveRow={removeRow}
                  onAddTrack={addTrack}
                  onCopy={handleCopy}
                  onPaste={handlePaste}
                  canPaste={canEpisodePaste}
                  batchTargetClient={batchTargetClient}
                  onBatchTargetChange={setBatchTargetClient}
                  onBatchApply={handleBatchApply}
                  onTrackChange={handleTrackChange}
                  episodeTargetOverride={episodeTargetOverride}
                  onTargetOverrideChange={setEpisodeTargetOverride}
                  timelineOptions={timelineList}
                />
              )}
            </>
          )}


          {mode !== "snapshot" && (
            <div style={{ marginTop: 10 }}>
              <label style={labelStyle} htmlFor="active-id">
                {mode === "timeline" ? "Timeline ID" : "Episode ID"}
              </label>
              <input
                id="active-id"
                type="text"
                value={activeData.id || ""}
                onChange={(e) =>
                  mode === "timeline"
                    ? updateTimeline({ ...timelineData, id: e.target.value })
                    : setEpisodeState({ ...episodeData, id: e.target.value })
                }
                style={{ width: "100%", marginBottom: 8 }}
                data-ai-field={mode === "timeline" ? "timeline.id" : "episode.id"}
              />
            </div>
          )}

          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={handleSave} disabled={isSaving} data-ai-action="timeline-episode.save">
              {isSaving ? "儲存中" : "儲存"}
            </button>
            {mode === "timeline" && (
              <button type="button" onClick={handlePlayTimelineToClient} data-ai-action="timeline.play-client">
                直接播放到 client
              </button>
            )}
            {mode === "timeline" && (
              <button type="button" onClick={handlePlayPreview} data-ai-action="timeline.preview-play">
                以 iframe 預覽 timeline
              </button>
            )}
            {mode === "episode" && (
              <button type="button" onClick={handlePlayEpisode} data-ai-action="episode.play">
                播放 Episode（含覆寫）
              </button>
            )}
            {mode === "snapshot" && (
              <button type="button" onClick={handlePlaySnapshot} data-ai-action="snapshot.play">
                播放 snapshot
              </button>
            )}
          </div>
        </div>

        <div style={columnStyle} data-ai-section="timeline-episode.json-preview">
          <label style={labelStyle} htmlFor="json-area">
            JSON（雙向同步）
          </label>
          <textarea
            id="json-area"
            style={{ width: "100%", height: 240, fontFamily: "monospace" }}
            value={jsonText}
            onChange={(e) => handleJsonChange(e.target.value)}
            data-ai-field="timeline-episode.json"
          />
          <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => syncJsonFromData(mode === "timeline" ? timelineData : episodeData)}
              disabled={jsonLocked}
              data-ai-action="timeline-episode.sync-from-form"
            >
              以表單覆寫 JSON
            </button>
            <button type="button" onClick={() => setJsonLocked((prev) => !prev)} data-ai-action="timeline-episode.toggle-json-lock">
              {jsonLocked ? "解除鎖定" : "鎖定 JSON"}
            </button>
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>驗證結果</div>
            {validationErrors.length === 0 ? (
              <div style={{ color: "#3aff85" }} data-ai-status="timeline-episode.validation-ok">
                未發現錯誤
              </div>
            ) : (
              <ul style={{ paddingLeft: 16, color: "#ff6b6b" }} data-ai-status="timeline-episode.validation-errors">
                {validationErrors.map((err, idx) => (
                  <li key={`${err.path}-${idx}`}>
                    <strong>{err.path}：</strong>
                    {err.message}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {mode === "snapshot" && (
            <div
              style={{ ...previewContainerStyle, width: snapshotPreviewWidth, maxWidth: "100%", marginTop: 12 }}
              data-ai-section="snapshot.editor.preview"
              aria-label="Snapshot 預覽區塊"
            >
              <div style={previewTitleStyle}>預覽</div>
              {snapshotPreviewSrc ? (
                <iframe
                  title="snapshot-preview"
                  src={snapshotPreviewSrc}
                  style={{ ...snapshotPreviewIframeStyle, height: snapshotFrameHeight }}
                  sandbox="allow-scripts allow-same-origin"
                  data-ai-id="snapshot.editor.preview.iframe"
                />
              ) : (
                <div style={{ color: "#82dca5" }} data-ai-state="empty">
                  {snapshotPreviewError || "無法產生預覽，請確認至少有一個 panel.url 或 image"}
                </div>
              )}
              <div style={resizerHitboxStyle} onMouseDown={startSnapshotResize} aria-hidden="true">
                <div style={resizerHandleStyle} />
              </div>
            </div>
          )}

          {mode === "timeline" && (
            <TimelinePreviewPlayer
              previewSrc={timelinePreviewSrc}
              previewError={timelinePreviewError}
              playSrc={timelinePlaySrc}
              playError={timelinePlayError}
            />
          )}
        </div>
      </div>

      {message && (
        <div
          style={{ marginTop: 8, color: "#82dca5", letterSpacing: "0.03em" }}
          role="status"
          aria-live="polite"
          data-ai-status="timeline-episode.message"
        >
          {message}
        </div>
      )}
    </div>
  );
}
