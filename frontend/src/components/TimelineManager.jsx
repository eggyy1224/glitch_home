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
  const [timelineCloneTarget, setTimelineCloneTarget] = useState(defaultClientId || "desktop2");
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
    <div style={boxStyle}>
      <div style={{ marginBottom: 8 }}>
        <label style={labelStyle}>篩選 client</label>
        <input
          type="text"
          value={timelineClientFilter}
          onChange={(e) => setTimelineClientFilter(e.target.value)}
          placeholder="空白=全部"
          style={{ width: "200px", marginRight: 6 }}
        />
        <button type="button" onClick={refreshTimelines}>
          重新載入列表
        </button>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: 6 }}>Timeline 列表：</div>
          <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid #ddd", padding: 8 }}>
            {timelineList.length === 0 && <div>尚無 timeline</div>}
            {timelineList.map((item) => (
              <div key={item.id} style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
                <span style={{ flex: 1 }}>
                  {item.id} ({item.client_id || "n/a"})
                </span>
                <button type="button" onClick={() => handleLoadTimeline(item.id)} style={{ marginRight: 4 }}>
                  載入
                </button>
                <button type="button" onClick={() => handleDeleteTimeline(item.id)}>刪除</button>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8 }}>
            <div style={{ marginBottom: 4 }}>複製：</div>
            <input
              type="text"
              placeholder="new id"
              value={timelineCloneId}
              onChange={(e) => setTimelineCloneId(e.target.value)}
              style={{ width: "140px", marginRight: 4 }}
            />
            <input
              type="text"
              placeholder="target client (可空)"
              value={timelineCloneTarget}
              onChange={(e) => setTimelineCloneTarget(e.target.value)}
              style={{ width: "160px", marginRight: 4 }}
            />
            <button type="button" onClick={handleCloneTimeline}>
              複製 timeline
            </button>
          </div>
        </div>
        <div style={{ flex: 1.2 }}>
          <label style={labelStyle}>當前 timeline id</label>
          <input
            type="text"
            value={timelineId}
            onChange={(e) => setTimelineId(e.target.value)}
            placeholder="新建請輸入 id 或在 JSON 設定"
            style={{ width: "100%", marginBottom: 8 }}
          />
          <label style={labelStyle}>JSON</label>
          <textarea
            style={{ width: "100%", height: 260, fontFamily: "monospace" }}
            value={timelineJson}
            onChange={(e) => setTimelineJson(e.target.value)}
          />
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={() => handleSaveTimeline("create")}>
              新增
            </button>
            <button type="button" onClick={() => handleSaveTimeline("update")}>
              覆寫
            </button>
            <button type="button" onClick={() => setTimelineJson(pretty(defaultTimelinePayload(defaultClientId)))}>
              填入預設
            </button>
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ fontWeight: 600 }}>播放到 client</label>
            <input
              type="text"
              value={timelinePlayTarget}
              onChange={(e) => setTimelinePlayTarget(e.target.value)}
              placeholder="client id"
              style={{ width: 150 }}
            />
            <button type="button" onClick={handlePlayToClient}>
              播放
            </button>
            {timelinePlayStatus && <span style={{ color: "#444" }}>{timelinePlayStatus}</span>}
          </div>
        </div>
      </div>

      <div style={{ ...previewContainerStyle, width: timelinePreviewWidth, maxWidth: "100%" }}>
        <div style={{ ...previewTitleStyle, marginBottom: 10 }}>Timeline 預覽</div>
        <div style={timelinePreviewGridStyle}>
          <div>
            <div style={{ ...previewTitleStyle, marginBottom: 6 }}>取第一段 snapshot</div>
            {timelinePreviewSrc ? (
              <iframe
                title="timeline-preview"
                src={timelinePreviewSrc}
                style={{ ...timelinePreviewIframeStyle, height: timelineFrameHeight }}
                sandbox="allow-scripts allow-same-origin"
              />
            ) : (
              <div style={{ color: "#888" }}>
                {timelinePreviewError || "無法產生預覽，請確認 steps 有 snapshot，且對應 snapshot 有 panel.url 或 image"}
              </div>
            )}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={previewTitleStyle}>播放預覽（整段 timeline）</div>
              <button type="button" onClick={handlePlayTimelinePreview}>
                播放
              </button>
              {timelinePlayError && <span style={{ color: "#c00" }}>{timelinePlayError}</span>}
            </div>
            {timelinePlaySrc ? (
              <iframe
                key={timelinePlaySrc}
                title="timeline-play-preview"
                src={timelinePlaySrc}
                style={{ ...timelinePreviewIframeStyle, height: timelineFrameHeight }}
                sandbox="allow-scripts allow-same-origin"
              />
            ) : (
              <div style={{ color: "#888" }}>
                點擊「播放」會以 iframe_mode 在下方預覽完整 timeline（需先儲存服務端資料）
              </div>
            )}
          </div>
        </div>

        <div style={resizerHitboxStyle} onMouseDown={startResize}>
          <div style={resizerHandleStyle} />
        </div>
      </div>

      {timelineMessage && <div style={{ marginTop: 8, color: "#444" }}>{timelineMessage}</div>}
    </div>
  );
}
