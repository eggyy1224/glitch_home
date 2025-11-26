import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  createEpisode,
  createIframeTimeline,
  fetchEpisode,
  fetchIframeTimeline,
  getIframeSnapshot,
  listEpisodes,
  listIframeSnapshots,
  listIframeTimelines,
  playEpisode,
  playIframeTimeline,
  updateEpisode,
  updateIframeTimeline,
} from "../api.js";
import { AdminPanelContext } from "../AdminPanelContext";
import {
  boxStyle,
  columnsStyle,
  columnStyle,
  labelStyle,
  previewContainerStyle,
  previewTitleStyle,
  timelinePreviewIframeStyle,
} from "../AdminPanelStyles.js";
import {
  defaultEpisodePayload,
  defaultTimelinePayload,
  firstSnapshotRef,
  parseTargetMap,
  previewSrcFromConfig,
  pretty,
  timelinePlaybackSrc,
} from "../adminPanelUtils.js";

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

function formatTs(ts) {
  if (!ts) return "";
  const date = typeof ts === "string" ? new Date(ts) : ts;
  return date.toLocaleString();
}

function toggleIndex(selected, index) {
  if (selected.includes(index)) return selected.filter((i) => i !== index);
  return [...selected, index];
}

export default function TimelineEpisodeEditor() {
  const { defaultClientId } = useContext(AdminPanelContext);
  const [mode, setMode] = useState("timeline");
  const [timelineData, setTimelineData] = useState(() => defaultTimelinePayload(defaultClientId));
  const [episodeData, setEpisodeData] = useState(() => defaultEpisodePayload(defaultClientId));
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
  const [episodeTargetOverride, setEpisodeTargetOverride] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const activeData = useMemo(() => (mode === "timeline" ? timelineData : episodeData), [episodeData, mode, timelineData]);

  const syncJsonFromData = useCallback(
    (data) => {
      if (jsonLocked) return;
      setJsonText(pretty(data));
      setLastSyncAt(new Date());
    },
    [jsonLocked],
  );

  const updateTimeline = useCallback(
    (next) => {
      setTimelineData(next);
      syncJsonFromData(next);
      setDirty(true);
      setValidationErrors(validateTimeline(next));
    },
    [syncJsonFromData],
  );

  const updateEpisode = useCallback(
    (next) => {
      setEpisodeData(next);
      syncJsonFromData(next);
      setDirty(true);
      setValidationErrors(validateEpisode(next));
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
      } else {
        setValidationErrors(validateEpisode(episodeData));
        syncJsonFromData(episodeData);
      }
    },
    [episodeData, syncJsonFromData, timelineData],
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

  const refreshSnapshots = useCallback(async () => {
    try {
      const data = await listIframeSnapshots(snapshotClient || null);
      const list = Array.isArray(data.snapshots) ? data.snapshots : [];
      const filtered = snapshotKeyword
        ? list.filter((item) => `${item.id || item.name}`.includes(snapshotKeyword) || `${item.client}`.includes(snapshotKeyword))
        : list;
      setSnapshotOptions(filtered);
      setSnapshotMessage(`取得 ${filtered.length} 筆 snapshot`);
    } catch (err) {
      setSnapshotMessage(err.message || "載入 snapshot 清單失敗");
    }
  }, [snapshotClient, snapshotKeyword]);

  const handleLoadSelected = useCallback(
    async (id) => {
      if (!id) return;
      try {
        if (mode === "timeline") {
          const data = await fetchIframeTimeline(id, { resolve: false });
          const payload = data.timeline || data;
          updateTimeline(payload);
          setMessage(`已載入 timeline ${id}`);
        } else {
          const data = await fetchEpisode(id, { resolve: false });
          const payload = data.episode || data;
          updateEpisode(payload);
          setMessage(`已載入 episode ${id}`);
        }
      } catch (err) {
        setMessage(err.message || "載入失敗");
      }
    },
    [mode, updateEpisode, updateTimeline],
  );

  const handleSave = useCallback(async () => {
    try {
      setIsSaving(true);
      if (mode === "timeline") {
        const payload = timelineData;
        const targetId = (payload.id || "").trim();
        if (!targetId) throw new Error("timeline id 必填");
        const exists = timelineList.some((t) => t.id === targetId);
        if (exists) {
          await updateIframeTimeline(targetId, payload, { resolve: false });
        } else {
          await createIframeTimeline(payload, { resolve: false });
        }
        setMessage(`已儲存 timeline ${targetId}`);
        await refreshTimelines();
      } else {
        const payload = episodeData;
        const targetId = (payload.id || "").trim();
        if (!targetId) throw new Error("episode id 必填");
        const exists = episodeList.some((e) => e.id === targetId);
        if (exists) {
          await updateEpisode(targetId, payload, { resolve: false });
        } else {
          await createEpisode(payload, { resolve: false });
        }
        setMessage(`已儲存 episode ${targetId}`);
        await refreshEpisodes();
      }
      setDirty(false);
    } catch (err) {
      setMessage(err.message || "儲存失敗");
    } finally {
      setIsSaving(false);
    }
  }, [episodeData, episodeList, mode, refreshEpisodes, refreshTimelines, timelineData, timelineList]);

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
        } else {
          setEpisodeData(parsed);
          setValidationErrors(validateEpisode(parsed));
        }
        setLastSyncAt(new Date());
      } catch (err) {
        setValidationErrors([{ path: "json", message: err.message || "JSON 解析失敗" }]);
      }
    }, 500);
    return () => clearTimeout(handle);
  }, [jsonLocked, jsonText, mode]);

  useEffect(() => {
    setTimelineData(defaultTimelinePayload(defaultClientId));
    setEpisodeData(defaultEpisodePayload(defaultClientId));
    setJsonText(pretty(defaultTimelinePayload(defaultClientId)));
    setValidationErrors(validateTimeline(defaultTimelinePayload(defaultClientId)));
  }, [defaultClientId]);

  useEffect(() => {
    refreshTimelines();
    refreshEpisodes();
    refreshSnapshots();
  }, [refreshEpisodes, refreshSnapshots, refreshTimelines]);

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
      updateEpisode({
        ...episodeData,
        tracks: episodeData.tracks.map((track, i) => (i === index ? { ...track, ...patch } : track)),
      });
    },
    [episodeData, updateEpisode],
  );

  const addStep = useCallback(() => {
    updateTimeline({
      ...timelineData,
      steps: [...(timelineData.steps || []), { snapshot: `${defaultClientId}/snapshot_x`, duration: 5, label: "新步驟" }],
    });
  }, [defaultClientId, timelineData, updateTimeline]);

  const addTrack = useCallback(() => {
    updateEpisode({
      ...episodeData,
      tracks: [...(episodeData.tracks || []), { timelineId: "timeline_x", targetClientId: defaultClientId, offset: 0 }],
    });
  }, [defaultClientId, episodeData, updateEpisode]);

  const moveRow = useCallback(
    (index, delta) => {
      if (mode === "timeline") {
        const steps = [...(timelineData.steps || [])];
        const target = index + delta;
        if (target < 0 || target >= steps.length) return;
        const [item] = steps.splice(index, 1);
        steps.splice(target, 0, item);
        updateTimeline({ ...timelineData, steps });
      } else {
        const tracks = [...(episodeData.tracks || [])];
        const target = index + delta;
        if (target < 0 || target >= tracks.length) return;
        const [item] = tracks.splice(index, 1);
        tracks.splice(target, 0, item);
        updateEpisode({ ...episodeData, tracks });
      }
    },
    [episodeData, mode, timelineData, updateEpisode, updateTimeline],
  );

  const removeRow = useCallback(
    (index) => {
      if (mode === "timeline") {
        updateTimeline({ ...timelineData, steps: timelineData.steps.filter((_, i) => i !== index) });
      } else {
        updateEpisode({ ...episodeData, tracks: episodeData.tracks.filter((_, i) => i !== index) });
      }
      setSelectedRows((prev) => prev.filter((i) => i !== index));
    },
    [episodeData, mode, timelineData, updateEpisode, updateTimeline],
  );

  const duplicateRow = useCallback(
    (index) => {
      if (mode === "timeline") {
        const steps = [...(timelineData.steps || [])];
        const target = steps[index];
        steps.splice(index + 1, 0, { ...target });
        updateTimeline({ ...timelineData, steps });
      } else {
        const tracks = [...(episodeData.tracks || [])];
        const target = tracks[index];
        tracks.splice(index + 1, 0, { ...target });
        updateEpisode({ ...episodeData, tracks });
      }
    },
    [episodeData, mode, timelineData, updateEpisode, updateTimeline],
  );

  const handleCopy = useCallback(() => {
    if (!selectedRows.length) return;
    const items = selectedRows
      .map((idx) => (mode === "timeline" ? timelineData.steps[idx] : episodeData.tracks[idx]))
      .filter(Boolean);
    setClipboard({ mode, items });
    setMessage(`已複製 ${items.length} 筆`);
  }, [episodeData.tracks, mode, selectedRows, timelineData.steps]);

  const handlePaste = useCallback(() => {
    if (!clipboard || clipboard.mode !== mode || !clipboard.items?.length) return;
    if (mode === "timeline") {
      updateTimeline({
        ...timelineData,
        steps: [...(timelineData.steps || []), ...clipboard.items.map((item) => ({ ...item }))],
      });
    } else {
      updateEpisode({
        ...episodeData,
        tracks: [...(episodeData.tracks || []), ...clipboard.items.map((item) => ({ ...item }))],
      });
    }
    setMessage(`已貼上 ${clipboard.items.length} 筆`);
  }, [clipboard, episodeData, mode, timelineData, updateEpisode, updateTimeline]);

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
      updateEpisode({
        ...episodeData,
        tracks: episodeData.tracks.map((track, idx) =>
          selectedRows.includes(idx) ? { ...track, targetClientId: batchTargetClient } : track,
        ),
      });
    }
  }, [batchDuration, batchTargetClient, episodeData, mode, selectedRows, timelineData, updateEpisode, updateTimeline]);

  const handlePlayPreview = useCallback(() => {
    if (mode !== "timeline") return;
    const id = timelineData.id;
    if (!id) {
      setTimelinePlayError("請先設定 id 並儲存");
      return;
    }
    setTimelinePlayError(null);
    setTimelinePlaySrc(timelinePlaybackSrc(id));
  }, [mode, timelineData.id]);

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

  const activeList = mode === "timeline" ? timelineList : episodeList;

  return (
    <div style={boxStyle} data-ai-id="admin.timeline-episode-editor">
      <div style={{ marginBottom: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => handleModeChange("timeline")}
          style={{ fontWeight: mode === "timeline" ? 800 : 500 }}
        >
          Timeline 模式
        </button>
        <button
          type="button"
          onClick={() => handleModeChange("episode")}
          style={{ fontWeight: mode === "episode" ? 800 : 500 }}
        >
          Episode 模式
        </button>
        <span style={{ color: dirty ? "#d00" : "#444" }}>{dirty ? "未保存變更" : "已同步"}</span>
        <span style={{ color: "#777" }}>最後同步：{formatTs(lastSyncAt) || "--"}</span>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            checked={jsonLocked}
            onChange={(e) => setJsonLocked(e.target.checked)}
            aria-label="鎖定 JSON"
          />
          鎖定 JSON 同步
        </label>
      </div>

      <div style={columnsStyle}>
        <div style={columnStyle}>
          <div style={{ marginBottom: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <label style={labelStyle} htmlFor="timeline-search">
              {mode === "timeline" ? "Timeline 列表" : "Episode 列表"}
            </label>
            {mode === "timeline" ? (
              <input
                id="timeline-search"
                type="text"
                value={timelineFilter}
                onChange={(e) => setTimelineFilter(e.target.value)}
                placeholder="client 篩選"
                style={{ width: 140 }}
              />
            ) : (
              <input
                id="episode-search"
                type="text"
                value={episodeFilter}
                onChange={(e) => setEpisodeFilter(e.target.value)}
                placeholder="id 篩選"
                style={{ width: 140 }}
              />
            )}
            <button type="button" onClick={mode === "timeline" ? refreshTimelines : refreshEpisodes}>
              重新載入
            </button>
          </div>
          <div style={{ border: "1px solid #ddd", borderRadius: 6, maxHeight: 200, overflowY: "auto", padding: 8 }}>
            {activeList.length === 0 && <div style={{ color: "#777" }}>尚無資料</div>}
            {activeList.map((item) => (
              <div key={item.id} style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
                <div style={{ flex: 1 }}>
                  {item.id}
                  {mode === "timeline" ? ` (${item.client_id || "n/a"})` : ""}
                </div>
                <button type="button" onClick={() => handleLoadSelected(item.id)}>
                  載入
                </button>
              </div>
            ))}
          </div>

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
                  : updateEpisode({ ...episodeData, id: e.target.value })
              }
              style={{ width: "100%", marginBottom: 8 }}
            />
          </div>

          {mode === "timeline" ? (
            <div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
                <button type="button" onClick={addStep}>
                  新增 step
                </button>
                <button type="button" onClick={handleCopy} disabled={!selectedRows.length}>
                  複製選取
                </button>
                <button type="button" onClick={handlePaste} disabled={!clipboard || clipboard.mode !== "timeline"}>
                  貼上
                </button>
                <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  批次 duration
                  <input
                    type="number"
                    value={batchDuration}
                    onChange={(e) => setBatchDuration(e.target.value)}
                    style={{ width: 100 }}
                  />
                  <button type="button" onClick={handleBatchApply} disabled={!batchDuration || !selectedRows.length}>
                    套用
                  </button>
                </label>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <input
                  type="text"
                  placeholder="snapshot client"
                  value={snapshotClient || ""}
                  onChange={(e) => setSnapshotClient(e.target.value)}
                  style={{ width: 140 }}
                />
                <input
                  type="text"
                  placeholder="keyword"
                  value={snapshotKeyword}
                  onChange={(e) => setSnapshotKeyword(e.target.value)}
                  style={{ width: 140 }}
                />
                <button type="button" onClick={refreshSnapshots}>
                  更新 snapshot 選項
                </button>
                {snapshotMessage && <span style={{ color: "#777" }}>{snapshotMessage}</span>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(timelineData.steps || []).map((step, index) => (
                  <div
                    key={index}
                    style={{ border: "1px solid #ddd", borderRadius: 6, padding: 8, background: selectedRows.includes(index) ? "#eef6ff" : "#fff" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <input
                          type="checkbox"
                          checked={selectedRows.includes(index)}
                          onChange={() => setSelectedRows((prev) => toggleIndex(prev, index))}
                          aria-label={`選取 step ${index + 1}`}
                        />
                        Step {index + 1}
                      </label>
                      <button type="button" onClick={() => moveRow(index, -1)} aria-label="上移">
                        ↑
                      </button>
                      <button type="button" onClick={() => moveRow(index, 1)} aria-label="下移">
                        ↓
                      </button>
                      <button type="button" onClick={() => duplicateRow(index)} aria-label="複製 step">
                        複製
                      </button>
                      <button type="button" onClick={() => removeRow(index)} aria-label="刪除 step">
                        刪除
                      </button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <label style={{ display: "flex", flexDirection: "column" }}>
                        Snapshot
                        <select
                          value={step.snapshot || ""}
                          onChange={(e) => handleStepChange(index, { snapshot: e.target.value })}
                        >
                          <option value="">-- 選擇 snapshot --</option>
                          {snapshotOptions.map((opt) => (
                            <option key={`${opt.client}/${opt.id || opt.name}`} value={`${opt.client}/${opt.id || opt.name}`}>
                              {opt.client}/{opt.id || opt.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label style={{ display: "flex", flexDirection: "column" }}>
                        duration（秒）
                        <input
                          type="number"
                          value={step.duration ?? ""}
                          onChange={(e) => handleStepChange(index, { duration: Number(e.target.value) })}
                        />
                      </label>
                      <label style={{ display: "flex", flexDirection: "column" }}>
                        label
                        <input
                          type="text"
                          value={step.label || ""}
                          onChange={(e) => handleStepChange(index, { label: e.target.value })}
                        />
                      </label>
                      <label style={{ display: "flex", flexDirection: "column" }}>
                        client override
                        <input
                          type="text"
                          value={step.clientId || step.client_id || ""}
                          onChange={(e) => handleStepChange(index, { clientId: e.target.value })}
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
                <button type="button" onClick={addTrack}>
                  新增 track
                </button>
                <button type="button" onClick={handleCopy} disabled={!selectedRows.length}>
                  複製選取
                </button>
                <button type="button" onClick={handlePaste} disabled={!clipboard || clipboard.mode !== "episode"}>
                  貼上
                </button>
                <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  批次 target
                  <input
                    type="text"
                    value={batchTargetClient}
                    onChange={(e) => setBatchTargetClient(e.target.value)}
                    style={{ width: 160 }}
                  />
                  <button type="button" onClick={handleBatchApply} disabled={!batchTargetClient || !selectedRows.length}>
                    套用
                  </button>
                </label>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(episodeData.tracks || []).map((track, index) => (
                  <div
                    key={index}
                    style={{ border: "1px solid #ddd", borderRadius: 6, padding: 8, background: selectedRows.includes(index) ? "#eef6ff" : "#fff" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <input
                          type="checkbox"
                          checked={selectedRows.includes(index)}
                          onChange={() => setSelectedRows((prev) => toggleIndex(prev, index))}
                          aria-label={`選取 track ${index + 1}`}
                        />
                        Track {index + 1}
                      </label>
                      <button type="button" onClick={() => moveRow(index, -1)} aria-label="上移">
                        ↑
                      </button>
                      <button type="button" onClick={() => moveRow(index, 1)} aria-label="下移">
                        ↓
                      </button>
                      <button type="button" onClick={() => duplicateRow(index)} aria-label="複製 track">
                        複製
                      </button>
                      <button type="button" onClick={() => removeRow(index)} aria-label="刪除 track">
                        刪除
                      </button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <label style={{ display: "flex", flexDirection: "column" }}>
                        timelineId
                        <input
                          type="text"
                          value={track.timelineId || track.timeline_id || ""}
                          onChange={(e) => handleTrackChange(index, { timelineId: e.target.value })}
                        />
                      </label>
                      <label style={{ display: "flex", flexDirection: "column" }}>
                        targetClientId
                        <input
                          type="text"
                          value={track.targetClientId || track.target_client_id || ""}
                          onChange={(e) => handleTrackChange(index, { targetClientId: e.target.value })}
                        />
                      </label>
                      <label style={{ display: "flex", flexDirection: "column" }}>
                        offset/delay
                        <input
                          type="number"
                          value={track.offset ?? track.delay ?? 0}
                          onChange={(e) => handleTrackChange(index, { offset: Number(e.target.value) })}
                        />
                      </label>
                      <label style={{ display: "flex", flexDirection: "column" }}>
                        label
                        <input
                          type="text"
                          value={track.label || ""}
                          onChange={(e) => handleTrackChange(index, { label: e.target.value })}
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10 }}>
                <label style={labelStyle} htmlFor="episode-target-override">
                  目標 map 覆寫（timeline:client，以逗號分隔）
                </label>
                <input
                  id="episode-target-override"
                  type="text"
                  value={episodeTargetOverride}
                  onChange={(e) => setEpisodeTargetOverride(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>
            </div>
          )}

          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "儲存中" : "儲存"}
            </button>
            {mode === "timeline" && (
              <button type="button" onClick={handlePlayTimelineToClient}>
                直接播放到 client
              </button>
            )}
            {mode === "timeline" && (
              <button type="button" onClick={handlePlayPreview}>
                以 iframe 預覽 timeline
              </button>
            )}
            {mode === "episode" && (
              <button type="button" onClick={handlePlayEpisode}>
                播放 Episode（含覆寫）
              </button>
            )}
          </div>
        </div>

        <div style={columnStyle}>
          <label style={labelStyle} htmlFor="json-area">
            JSON（雙向同步）
          </label>
          <textarea
            id="json-area"
            style={{ width: "100%", height: 240, fontFamily: "monospace" }}
            value={jsonText}
            onChange={(e) => handleJsonChange(e.target.value)}
          />
          <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={() => syncJsonFromData(mode === "timeline" ? timelineData : episodeData)} disabled={jsonLocked}>
              以表單覆寫 JSON
            </button>
            <button type="button" onClick={() => setJsonLocked((prev) => !prev)}>
              {jsonLocked ? "解除鎖定" : "鎖定 JSON"}
            </button>
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>驗證結果</div>
            {validationErrors.length === 0 ? (
              <div style={{ color: "#0a0" }}>未發現錯誤</div>
            ) : (
              <ul style={{ paddingLeft: 16, color: "#c00" }}>
                {validationErrors.map((err, idx) => (
                  <li key={`${err.path}-${idx}`}>
                    <strong>{err.path}：</strong>
                    {err.message}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {mode === "timeline" && (
            <div style={previewContainerStyle}>
              <div style={previewTitleStyle}>首段 snapshot 預覽</div>
              {timelinePreviewSrc ? (
                <iframe
                  title="timeline-first-preview"
                  src={timelinePreviewSrc}
                  style={{ ...timelinePreviewIframeStyle, minHeight: 260 }}
                  sandbox="allow-scripts allow-same-origin"
                />
              ) : (
                <div style={{ color: "#aaa" }}>{timelinePreviewError || "無法產生預覽"}</div>
              )}
              <div style={{ ...previewTitleStyle, marginTop: 10 }}>整段播放預覽</div>
              {timelinePlaySrc ? (
                <iframe
                  key={timelinePlaySrc}
                  title="timeline-full-preview"
                  src={timelinePlaySrc}
                  style={{ ...timelinePreviewIframeStyle, minHeight: 260 }}
                  sandbox="allow-scripts allow-same-origin"
                />
              ) : (
                <div style={{ color: "#aaa" }}>{timelinePlayError || "點擊「以 iframe 預覽」後顯示"}</div>
              )}
            </div>
          )}
        </div>
      </div>

      {message && (
        <div style={{ marginTop: 8, color: "#444" }} role="status" aria-live="polite">
          {message}
        </div>
      )}
    </div>
  );
}
