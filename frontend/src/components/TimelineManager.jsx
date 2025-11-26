import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  cloneIframeTimeline,
  createIframeTimeline,
  deleteIframeTimeline,
  fetchIframeTimeline,
  listIframeTimelines,
  playIframeTimeline,
  updateIframeTimeline,
} from "../api.js";
import { AdminPanelContext } from "../AdminPanelContext";
import {
  boxStyle,
  labelStyle,
  previewContainerStyle,
  previewTitleStyle,
  resizerHandleStyle,
  resizerHitboxStyle,
  timelinePreviewGridStyle,
  timelinePreviewIframeStyle,
} from "../AdminPanelStyles.js";
import { defaultTimelinePayload, firstSnapshotRef, previewSrcFromConfig, pretty, timelinePlaybackSrc } from "../adminPanelUtils.js";
import { getIframeSnapshot } from "../api.js";

export default function TimelineManager() {
  const { defaultClientId } = useContext(AdminPanelContext);
  const defaultPreviewWidth = useMemo(() => {
    if (typeof window === "undefined") return 960;
    return Math.max(Math.min(window.innerWidth - 100, 1200), 720);
  }, []);

  const [timelineList, setTimelineList] = useState([]);
  const [timelineClientFilter, setTimelineClientFilter] = useState("");
  const [timelineId, setTimelineId] = useState("");
  const [timelineJson, setTimelineJson] = useState(() => pretty(defaultTimelinePayload(defaultClientId)));
  const [timelineMessage, setTimelineMessage] = useState("");
  const [timelineCloneId, setTimelineCloneId] = useState("");
  const [timelineCloneTarget, setTimelineCloneTarget] = useState(() => {
    const base = defaultClientId && defaultClientId !== "admin" ? defaultClientId : "desktop";
    return base === "desktop" ? "desktop2" : base;
  });
  const [timelinePreviewSrc, setTimelinePreviewSrc] = useState(null);
  const [timelinePreviewError, setTimelinePreviewError] = useState(null);
  const [timelinePlaySrc, setTimelinePlaySrc] = useState(null);
  const [timelinePlayError, setTimelinePlayError] = useState(null);
  const [timelinePlayTarget, setTimelinePlayTarget] = useState(defaultClientId);
  const [timelinePlayStatus, setTimelinePlayStatus] = useState("");
  const [timelinePreviewWidth, setTimelinePreviewWidth] = useState(defaultPreviewWidth);

  const timelineFrameHeight = useMemo(() => {
    const colWidth = (timelinePreviewWidth - 12) / 2;
    const width = colWidth > 0 ? colWidth : timelinePreviewWidth / 2;
    return Math.max(320, Math.round((width * 9) / 16));
  }, [timelinePreviewWidth]);

  const clampPreviewWidth = useCallback((width) => {
    const max = typeof window !== "undefined" ? Math.max(window.innerWidth - 60, 640) : 1400;
    return Math.min(Math.max(width, 560), Math.min(max, 1800));
  }, []);

  const startResize = useCallback(
    (event) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = timelinePreviewWidth;
      const onMove = (e) => {
        const delta = e.clientX - startX;
        setTimelinePreviewWidth(clampPreviewWidth(startWidth + delta));
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [clampPreviewWidth, timelinePreviewWidth],
  );

  const refreshTimelines = useCallback(async () => {
    try {
      const data = await listIframeTimelines(timelineClientFilter || null);
      setTimelineList(Array.isArray(data.timelines) ? data.timelines : []);
      setTimelineMessage(`已載入 ${data.timelines?.length ?? 0} 筆 timeline`);
    } catch (err) {
      setTimelineMessage(err.message || "載入 timeline 失敗");
    }
  }, [timelineClientFilter]);

  const handleLoadTimeline = useCallback(async (id) => {
    try {
      const data = await fetchIframeTimeline(id, { resolve: false });
      setTimelineId(id);
      setTimelineJson(pretty(data.timeline || data));
      const resolvedTarget = data?.timeline?.clientId || data?.timeline?.client_id || timelinePlayTarget;
      if (resolvedTarget) {
        setTimelinePlayTarget(resolvedTarget);
      }
      setTimelineMessage(`已載入 timeline ${id}`);
      setTimelinePlaySrc(null);
      setTimelinePlayError(null);
    } catch (err) {
      setTimelineMessage(err.message || "載入 timeline 失敗");
    }
  }, [timelinePlayTarget]);

  const handleSaveTimeline = useCallback(
    async (mode) => {
      try {
        const parsed = JSON.parse(timelineJson);
        const inputId = (timelineId || "").trim();
        const targetId = (mode === "update" ? inputId || parsed.id : parsed.id || inputId) || parsed.id;
        if (!targetId) {
          throw new Error("timeline id 必須提供在 JSON 內或輸入框");
        }
        const payload = { ...parsed, id: targetId };
        if (mode === "update") {
          await updateIframeTimeline(targetId, payload, { resolve: false });
        } else {
          await createIframeTimeline(payload, { resolve: false });
        }
        setTimelineId(targetId);
        if (payload.clientId || payload.client_id) {
          setTimelinePlayTarget(payload.clientId || payload.client_id);
        }
        setTimelineMessage(`${mode === "update" ? "已更新" : "已建立"} timeline ${targetId}`);
        setTimelinePlaySrc(null);
        setTimelinePlayError(null);
        await refreshTimelines();
      } catch (err) {
        setTimelineMessage(err.message || "儲存失敗");
      }
    },
    [refreshTimelines, timelineId, timelineJson],
  );

  const handleDeleteTimeline = useCallback(
    async (id) => {
      try {
        await deleteIframeTimeline(id);
        setTimelineMessage(`已刪除 timeline ${id}`);
        await refreshTimelines();
        if (timelineId === id) {
          setTimelineId("");
        }
        setTimelinePlaySrc(null);
        setTimelinePlayError(null);
        setTimelinePlayStatus("");
      } catch (err) {
        setTimelineMessage(err.message || "刪除失敗");
      }
    },
    [refreshTimelines, timelineId],
  );

  const handleCloneTimeline = useCallback(async () => {
    if (!timelineId || !timelineCloneId) {
      setTimelineMessage("請先載入 source timeline 並填入 new id");
      return;
    }
    try {
      await cloneIframeTimeline(
        timelineId,
        {
          new_id: timelineCloneId,
          target_client_id: timelineCloneTarget || undefined,
        },
        { resolve: false },
      );
      setTimelineMessage(`已複製 timeline 為 ${timelineCloneId}`);
      await refreshTimelines();
    } catch (err) {
      setTimelineMessage(err.message || "複製失敗");
    }
  }, [refreshTimelines, timelineCloneId, timelineCloneTarget, timelineId]);

  const handlePlayTimelinePreview = useCallback(() => {
    try {
      const parsed = JSON.parse(timelineJson);
      const id = (timelineId || parsed.id || "").trim();
      if (!id) {
        setTimelinePlayError("請先設定 timeline id，並儲存後再播放");
        return;
      }
      setTimelinePlayError(null);
      setTimelinePlaySrc(timelinePlaybackSrc(id));
    } catch (err) {
      setTimelinePlayError("JSON 解析失敗，無法播放");
    }
  }, [timelineId, timelineJson]);

  const handlePlayToClient = useCallback(async () => {
    if (!timelineId) {
      setTimelinePlayStatus("請先載入或儲存 timeline");
      return;
    }
    if (!timelinePlayTarget.trim()) {
      setTimelinePlayStatus("請輸入 target client");
      return;
    }
    try {
      setTimelinePlayStatus("發送中...");
      await playIframeTimeline(timelineId, {}, { targetClientId: timelinePlayTarget.trim() });
      setTimelinePlayStatus(`已送出播放到 ${timelinePlayTarget.trim()}`);
    } catch (err) {
      setTimelinePlayStatus(err.message || "播放指令失敗");
    }
  }, [timelineId, timelinePlayTarget]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const updatePreview = async () => {
      try {
        const parsed = JSON.parse(timelineJson);
        const firstRef = firstSnapshotRef(parsed);
        if (!firstRef) {
          setTimelinePreviewSrc(null);
          setTimelinePreviewError(null);
          return;
        }
        setTimelinePreviewError(null);
        const snapshot = await getIframeSnapshot(firstRef.client, firstRef.name, { signal: controller.signal });
        if (cancelled) return;
        const raw = snapshot.raw || snapshot.snapshot || snapshot;
        setTimelinePreviewSrc(previewSrcFromConfig(raw));
      } catch (err) {
        if (cancelled || err?.name === "AbortError") return;
        setTimelinePreviewSrc(null);
        setTimelinePreviewError(err.message || "預覽取得失敗");
      }
    };
    void updatePreview();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [timelineJson]);

  useEffect(() => {
    setTimelinePlaySrc(null);
    setTimelinePlayError(null);
    setTimelinePlayStatus("");
  }, [timelineJson, timelineId]);

  useEffect(() => {
    refreshTimelines();
  }, [refreshTimelines]);

  return (
    <div style={boxStyle} data-ai-id="admin.timeline.section">
      <div style={{ marginBottom: 8 }}>
        <label style={labelStyle} htmlFor="timeline-client-filter">
          篩選 client
        </label>
        <input
          id="timeline-client-filter"
          name="timeline-client-filter"
          type="text"
          value={timelineClientFilter}
          onChange={(e) => setTimelineClientFilter(e.target.value)}
          placeholder="空白=全部"
          style={{ width: "200px", marginRight: 6 }}
          data-ai-field="timeline.filter-client"
        />
        <button type="button" onClick={refreshTimelines} data-ai-action="timeline.reload-list" aria-label="重新載入 timeline 列表">
          重新載入列表
        </button>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: 6 }}>Timeline 列表：</div>
          <ul
            role="list"
            data-ai-id="timeline.list"
            style={{
              maxHeight: 220,
              overflowY: "auto",
              border: "1px solid #0f4",
              padding: 8,
              listStyle: "none",
              margin: 0,
              background: "#000",
            }}
          >
            {timelineList.length === 0 && <li data-ai-state="empty">尚無 timeline</li>}
            {timelineList.map((item) => (
              <li
                key={item.id}
                role="listitem"
                data-ai-item={`timeline:${item.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: 6,
                  padding: "4px 4px",
                  borderRadius: 0,
                  background: "#000",
                  border: "1px solid #0f4",
                }}
              >
                <span style={{ flex: 1 }}>
                  {item.id} ({item.client_id || "n/a"})
                </span>
                <button
                  type="button"
                  onClick={() => handleLoadTimeline(item.id)}
                  style={{ marginRight: 4 }}
                  data-ai-action="timeline.load"
                  aria-label={`載入 timeline ${item.id}`}
                >
                  載入
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteTimeline(item.id)}
                  data-ai-action="timeline.delete"
                  aria-label={`刪除 timeline ${item.id}`}
                  data-ai-danger="true"
                >
                  刪除
                </button>
              </li>
            ))}
          </ul>
          <div style={{ marginTop: 8 }}>
            <div style={{ marginBottom: 4 }}>複製：</div>
            <input
              type="text"
              placeholder="new id"
              value={timelineCloneId}
              onChange={(e) => setTimelineCloneId(e.target.value)}
              style={{ width: "140px", marginRight: 4 }}
              data-ai-field="timeline.clone.new-id"
              aria-label="複製的新 timeline id"
            />
            <input
              type="text"
              placeholder="target client (可空)"
              value={timelineCloneTarget}
              onChange={(e) => setTimelineCloneTarget(e.target.value)}
              style={{ width: "160px", marginRight: 4 }}
              data-ai-field="timeline.clone.target-client"
              aria-label="複製目標 client"
            />
            <button type="button" onClick={handleCloneTimeline} data-ai-action="timeline.clone" aria-label="複製 timeline">
              複製 timeline
            </button>
          </div>
        </div>
        <div style={{ flex: 1.2 }}>
          <label style={labelStyle} htmlFor="timeline-id">
            當前 timeline id
          </label>
          <input
            id="timeline-id"
            name="timeline-id"
            type="text"
            value={timelineId}
            onChange={(e) => setTimelineId(e.target.value)}
            placeholder="新建請輸入 id 或在 JSON 設定"
            style={{ width: "100%", marginBottom: 8 }}
            data-ai-field="timeline.id"
          />
          <label style={labelStyle} htmlFor="timeline-json">
            JSON
          </label>
          <textarea
            id="timeline-json"
            name="timeline-json"
            style={{ width: "100%", height: 260, fontFamily: "monospace" }}
            value={timelineJson}
            onChange={(e) => setTimelineJson(e.target.value)}
            data-ai-field="timeline.json"
            aria-label="timeline JSON"
          />
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={() => handleSaveTimeline("create")} data-ai-action="timeline.create">
              新增
            </button>
            <button type="button" onClick={() => handleSaveTimeline("update")} data-ai-action="timeline.update">
              覆寫
            </button>
            <button
              type="button"
              onClick={() => setTimelineJson(pretty(defaultTimelinePayload(defaultClientId)))}
              data-ai-action="timeline.fill-default"
            >
              填入預設
            </button>
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ fontWeight: 600 }} htmlFor="timeline-play-target">
              播放到 client
            </label>
            <input
              id="timeline-play-target"
              name="timeline-play-target"
              type="text"
              value={timelinePlayTarget}
              onChange={(e) => setTimelinePlayTarget(e.target.value)}
              placeholder="client id"
              style={{ width: 150 }}
              data-ai-field="timeline.play-target"
            />
            <button type="button" onClick={handlePlayToClient} data-ai-action="timeline.play">
              播放
            </button>
            {timelinePlayStatus && (
              <span style={{ color: "#82dca5", letterSpacing: "0.03em" }} role="status" aria-live="polite" data-ai-status="timeline.play">
                {timelinePlayStatus}
              </span>
            )}
          </div>
        </div>
      </div>

      <div
        style={{ ...previewContainerStyle, width: timelinePreviewWidth, maxWidth: "100%" }}
        data-ai-section="timeline.preview"
        aria-label="Timeline 預覽區塊"
      >
        <div style={{ ...previewTitleStyle, marginBottom: 10 }}>Timeline 預覽</div>
        <div style={timelinePreviewGridStyle}>
          <div data-ai-section="timeline.preview.first-snapshot">
            <div style={{ ...previewTitleStyle, marginBottom: 6 }}>取第一段 snapshot</div>
            {timelinePreviewSrc ? (
              <iframe
                title="timeline-preview"
                src={timelinePreviewSrc}
                style={{ ...timelinePreviewIframeStyle, height: timelineFrameHeight }}
                sandbox="allow-scripts allow-same-origin"
                data-ai-id="timeline.preview.iframe"
              />
            ) : (
              <div style={{ color: "#82dca5" }} data-ai-state="empty">
                {timelinePreviewError || "無法產生預覽，請確認 steps 有 snapshot，且對應 snapshot 有 panel.url 或 image"}
              </div>
            )}
          </div>
          <div data-ai-section="timeline.preview.playback">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={previewTitleStyle}>播放預覽（整段 timeline）</div>
              <button type="button" onClick={handlePlayTimelinePreview} data-ai-action="timeline.preview-play">
                播放
              </button>
              {timelinePlayError && (
                <span style={{ color: "#ff6b6b" }} role="status" aria-live="polite" data-ai-status="timeline.preview-error">
                  {timelinePlayError}
                </span>
              )}
            </div>
            {timelinePlaySrc ? (
              <iframe
                key={timelinePlaySrc}
                title="timeline-play-preview"
                src={timelinePlaySrc}
                style={{ ...timelinePreviewIframeStyle, height: timelineFrameHeight }}
                sandbox="allow-scripts allow-same-origin"
                data-ai-id="timeline.preview.play-iframe"
              />
            ) : (
              <div style={{ color: "#82dca5" }} data-ai-state="empty">
                點擊「播放」會以 iframe_mode 在下方預覽完整 timeline（需先儲存服務端資料）
              </div>
            )}
          </div>
        </div>

        <div style={resizerHitboxStyle} onMouseDown={startResize} aria-hidden="true">
          <div style={resizerHandleStyle} />
        </div>
      </div>

      {timelineMessage && (
        <div
          style={{ marginTop: 8, color: "#82dca5", letterSpacing: "0.03em" }}
          role="status"
          aria-live="polite"
          data-ai-status="timeline.message"
        >
          {timelineMessage}
        </div>
      )}
    </div>
  );
}
