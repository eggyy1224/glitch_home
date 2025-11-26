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
  updateEpisode as updateEpisodeApi,
  updateIframeTimeline,
} from "../api.js";
import { AdminPanelContext } from "../AdminPanelContext";
import { boxStyle, columnsStyle, columnStyle, labelStyle } from "../AdminPanelStyles.js";
import {
  defaultEpisodePayload,
  defaultTimelinePayload,
  firstSnapshotRef,
  parseTargetMap,
  previewSrcFromConfig,
  pretty,
  timelinePlaybackSrc,
} from "../adminPanelUtils.js";
import EpisodeListPanel from "./timeline/EpisodeListPanel";
import EpisodeTracksEditor from "./timeline/EpisodeTracksEditor";
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
      setEpisodeData(next);
      syncJsonFromData(next);
      setDirty(Boolean(markDirty));
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
      } else {
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
      }
      setDirty(false);
      return true;
    } catch (err) {
      setMessage(err.message || "儲存失敗");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [episodeData, mode, refreshEpisodes, refreshTimelines, setEpisodeState, timelineData, updateTimeline]);

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
    setEpisodeState({
      ...episodeData,
      tracks: [...(episodeData.tracks || []), { timelineId: "timeline_x", targetClientId: defaultClientId, offset: 0 }],
    });
  }, [defaultClientId, episodeData, setEpisodeState]);

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
        setEpisodeState({ ...episodeData, tracks });
      }
    },
    [episodeData, mode, timelineData, setEpisodeState, updateTimeline],
  );

  const removeRow = useCallback(
    (index) => {
      if (mode === "timeline") {
        updateTimeline({ ...timelineData, steps: timelineData.steps.filter((_, i) => i !== index) });
      } else {
        setEpisodeState({ ...episodeData, tracks: episodeData.tracks.filter((_, i) => i !== index) });
      }
      setSelectedRows((prev) => prev.filter((i) => i !== index));
    },
    [episodeData, mode, setEpisodeState, timelineData, updateTimeline],
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
        setEpisodeState({ ...episodeData, tracks });
      }
    },
    [episodeData, mode, setEpisodeState, timelineData, updateTimeline],
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
      setEpisodeState({
        ...episodeData,
        tracks: [...(episodeData.tracks || []), ...clipboard.items.map((item) => ({ ...item }))],
      });
    }
    setMessage(`已貼上 ${clipboard.items.length} 筆`);
  }, [clipboard, episodeData, mode, setEpisodeState, timelineData, updateTimeline]);

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

  const canTimelinePaste = Boolean(clipboard && clipboard.mode === "timeline");
  const canEpisodePaste = Boolean(clipboard && clipboard.mode === "episode");

  return (
    <div style={boxStyle} data-ai-id="admin.timeline-episode-editor" data-ai-section="admin.timeline-episode-editor">
      <div
        style={{ marginBottom: 8, display: "flex", gap: 8, flexWrap: "wrap" }}
        role="tablist"
        aria-label="Timeline 或 Episode 模式選擇"
        data-ai-id="timeline-episode.mode-switch"
      >
        <button
          type="button"
          onClick={() => handleModeChange("timeline")}
          style={{ fontWeight: mode === "timeline" ? 800 : 500 }}
          role="tab"
          aria-selected={mode === "timeline"}
          aria-controls="timeline-editor-panel"
          id="timeline-editor-tab"
          data-ai-action="timeline-episode.switch-timeline"
        >
          Timeline 模式
        </button>
        <button
          type="button"
          onClick={() => handleModeChange("episode")}
          style={{ fontWeight: mode === "episode" ? 800 : 500 }}
          role="tab"
          aria-selected={mode === "episode"}
          aria-controls="episode-editor-panel"
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
          aria-labelledby={mode === "timeline" ? "timeline-editor-tab" : "episode-editor-tab"}
          id={mode === "timeline" ? "timeline-editor-panel" : "episode-editor-panel"}
          data-ai-section={mode === "timeline" ? "timeline.editor" : "episode.editor"}
        >
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
            />
          )}


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
