import React, { useEffect, useMemo, useState } from "react";
import {
  listIframeSnapshots,
  getIframeSnapshot,
  saveIframeSnapshot,
  deleteIframeSnapshot,
  cloneIframeSnapshot,
  listIframeTimelines,
  fetchIframeTimeline,
  createIframeTimeline,
  updateIframeTimeline,
  deleteIframeTimeline,
  cloneIframeTimeline,
  playIframeTimeline,
  listEpisodes,
  fetchEpisode,
  createEpisode,
  updateEpisode,
  deleteEpisode,
  cloneEpisode,
  playEpisode,
} from "./api.js";
import { buildQueryFromIframeConfig } from "./utils/iframeConfig.js";

const boxStyle = {
  border: "1px solid #ccc",
  borderRadius: 8,
  padding: 12,
  marginBottom: 16,
  background: "#fafafa",
};

const columnsStyle = {
  display: "flex",
  gap: 16,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const columnStyle = {
  flex: 1,
  minWidth: 420,
};

const labelStyle = { display: "block", fontWeight: 600, marginBottom: 6 };
const tabRowStyle = { display: "flex", gap: 8, marginBottom: 12 };
const tabButtonStyle = {
  padding: "8px 12px",
  borderRadius: 6,
  border: "1px solid #ccc",
  background: "#111",
  color: "#f5f5f5",
  cursor: "pointer",
  fontWeight: 600,
};
const activeTabButtonStyle = {
  ...tabButtonStyle,
  background: "#fff",
  color: "#111",
  borderColor: "#333",
};
const previewContainerStyle = {
  marginTop: 12,
  background: "#000",
  borderRadius: 10,
  padding: 12,
  position: "relative",
};
const previewTitleStyle = { marginBottom: 6, fontWeight: 700, color: "#ddd" };
const snapshotPreviewIframeStyle = {
  width: "100%",
  aspectRatio: "16 / 9",
  minHeight: 400,
  border: "1px solid #333",
  borderRadius: 8,
  background: "#111",
};
const timelinePreviewGridStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
  marginTop: 12,
};
const timelinePreviewIframeStyle = {
  width: "100%",
  aspectRatio: "16 / 9",
  minHeight: 340,
  border: "1px solid #333",
  borderRadius: 8,
  background: "#111",
};
const resizerHandleStyle = {
  position: "absolute",
  right: 8,
  bottom: 8,
  width: 14,
  height: 14,
  borderRadius: 4,
  background: "#888",
  border: "1px solid #555",
  cursor: "nwse-resize",
  boxShadow: "0 0 0 2px #000",
};
const resizerHitboxStyle = {
  position: "absolute",
  right: 0,
  bottom: 0,
  width: 32,
  height: 32,
  cursor: "nwse-resize",
};

function pretty(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (err) {
    return "";
  }
}

export default function AdminPanel({ clientId }) {
  const [activeTab, setActiveTab] = useState("snapshot");
  const [snapshotClient, setSnapshotClient] = useState(clientId || "desktop");
  const [snapshotList, setSnapshotList] = useState([]);
  const [snapshotName, setSnapshotName] = useState("");
  const [snapshotJson, setSnapshotJson] = useState(
    "{\n  \"layout\": \"grid\",\n  \"gap\": 0,\n  \"columns\": 1,\n  \"panels\": [\n    { \"id\": \"p1\", \"url\": \"/\" }\n  ]\n}",
  );
  const [snapshotMessage, setSnapshotMessage] = useState("");
  const [snapshotCloneTarget, setSnapshotCloneTarget] = useState(clientId || "desktop2");
  const [snapshotCloneName, setSnapshotCloneName] = useState("");
  const [snapshotPreviewSrc, setSnapshotPreviewSrc] = useState(null);
  const defaultPreviewWidth = useMemo(() => {
    if (typeof window !== "undefined") {
      return Math.min(window.innerWidth - 160, 1400);
    }
    return 960;
  }, []);
  const [snapshotPreviewWidth, setSnapshotPreviewWidth] = useState(defaultPreviewWidth);

  const [timelineList, setTimelineList] = useState([]);
  const [timelineClientFilter, setTimelineClientFilter] = useState("");
  const [timelineId, setTimelineId] = useState("");
  const [timelineJson, setTimelineJson] = useState(() =>
    pretty({
      id: "demo_timeline",
      title: "新 timeline",
      clientId: clientId || "desktop",
      loop: false,
      steps: [
        { snapshot: `${clientId || "desktop"}/sample_snapshot`, duration: 5, label: "第一段" },
      ],
    }),
  );
  const [timelineMessage, setTimelineMessage] = useState("");
  const [timelineCloneId, setTimelineCloneId] = useState("");
  const [timelineCloneTarget, setTimelineCloneTarget] = useState(clientId || "desktop2");
  const [timelinePreviewSrc, setTimelinePreviewSrc] = useState(null);
  const [timelinePreviewError, setTimelinePreviewError] = useState(null);
  const [timelinePlaySrc, setTimelinePlaySrc] = useState(null);
  const [timelinePlayError, setTimelinePlayError] = useState(null);
  const [timelinePlayTarget, setTimelinePlayTarget] = useState(clientId || "desktop");
  const [timelinePlayStatus, setTimelinePlayStatus] = useState("");
  const [timelinePreviewWidth, setTimelinePreviewWidth] = useState(defaultPreviewWidth);

  const [episodeList, setEpisodeList] = useState([]);
  const [episodeId, setEpisodeId] = useState("");
  const [episodeJson, setEpisodeJson] = useState(() => pretty(_defaultEpisodePayload(clientId || "desktop")));
  const [episodeMessage, setEpisodeMessage] = useState("");
  const [episodeCloneId, setEpisodeCloneId] = useState("");
  const [episodePlayStatus, setEpisodePlayStatus] = useState("");
  const [episodeTargetMapText, setEpisodeTargetMapText] = useState("");
  const [episodeCommandPrefix, setEpisodeCommandPrefix] = useState("");

  const resolvedClientLabel = useMemo(() => snapshotClient || "(未設定)", [snapshotClient]);
  const snapshotFrameHeight = useMemo(
    () => Math.max(320, Math.round((snapshotPreviewWidth * 9) / 16)),
    [snapshotPreviewWidth],
  );
  const timelineFrameHeight = useMemo(() => {
    const colWidth = (timelinePreviewWidth - 12) / 2;
    const width = colWidth > 0 ? colWidth : timelinePreviewWidth / 2;
    return Math.max(320, Math.round((width * 9) / 16));
  }, [timelinePreviewWidth]);
  const clampPreviewWidth = (width) => {
    const max = typeof window !== "undefined" ? Math.max(window.innerWidth - 60, 640) : 1400;
    return Math.min(Math.max(width, 560), Math.min(max, 1800));
  };
  const startResize = (event, target) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = target === "snapshot" ? snapshotPreviewWidth : timelinePreviewWidth;
    const onMove = (e) => {
      const delta = e.clientX - startX;
      const next = clampPreviewWidth(startWidth + delta);
      if (target === "snapshot") {
        setSnapshotPreviewWidth(next);
      } else {
        setTimelinePreviewWidth(next);
      }
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const refreshSnapshots = async () => {
    try {
      const data = await listIframeSnapshots(snapshotClient || null);
      setSnapshotList(Array.isArray(data.snapshots) ? data.snapshots : []);
      setSnapshotMessage(`已載入 ${data.snapshots?.length ?? 0} 筆 snapshot (${resolvedClientLabel})`);
    } catch (err) {
      setSnapshotMessage(err.message || "載入 snapshot 失敗");
    }
  };

  const refreshTimelines = async () => {
    try {
      const data = await listIframeTimelines(timelineClientFilter || null);
      setTimelineList(Array.isArray(data.timelines) ? data.timelines : []);
      setTimelineMessage(`已載入 ${data.timelines?.length ?? 0} 筆 timeline`);
    } catch (err) {
      setTimelineMessage(err.message || "載入 timeline 失敗");
    }
  };

  const refreshEpisodes = async () => {
    try {
      const data = await listEpisodes();
      setEpisodeList(Array.isArray(data.episodes) ? data.episodes : []);
      setEpisodeMessage(`已載入 ${data.episodes?.length ?? 0} 筆 episode`);
    } catch (err) {
      setEpisodeMessage(err.message || "載入 episode 失敗");
    }
  };

  useEffect(() => {
    refreshSnapshots();
    refreshTimelines();
    refreshEpisodes();
  }, []);

  const handleLoadSnapshot = async (name) => {
    try {
      const data = await getIframeSnapshot(snapshotClient, name);
      const raw = data.raw || data.snapshot || data;
      setSnapshotName(name);
      setSnapshotJson(pretty(raw));
      setSnapshotPreviewSrc(_previewSrcFromConfig(raw));
      setSnapshotMessage(`已載入 snapshot ${name}`);
    } catch (err) {
      setSnapshotMessage(err.message || "載入 snapshot 失敗");
    }
  };

  const handleSaveSnapshot = async () => {
    if (!snapshotName.trim()) {
      setSnapshotMessage("請輸入 snapshot 名稱");
      return;
    }
    try {
      const parsed = JSON.parse(snapshotJson);
      const data = await saveIframeSnapshot(snapshotClient, snapshotName.trim(), parsed);
      setSnapshotMessage(`已儲存 snapshot ${data.snapshot?.name || snapshotName}`);
      setSnapshotPreviewSrc(_previewSrcFromConfig(parsed));
      await refreshSnapshots();
    } catch (err) {
      setSnapshotMessage(err.message || "儲存失敗");
    }
  };

  const handleDeleteSnapshot = async (name) => {
    try {
      await deleteIframeSnapshot(snapshotClient, name);
      setSnapshotMessage(`已刪除 snapshot ${name}`);
      await refreshSnapshots();
      if (snapshotName === name) {
        setSnapshotName("");
      }
    } catch (err) {
      setSnapshotMessage(err.message || "刪除失敗");
    }
  };

  const handleCloneSnapshot = async (name) => {
    try {
      await cloneIframeSnapshot(snapshotClient, name, {
        target_client: snapshotCloneTarget,
        target_name: snapshotCloneName || name,
      });
      setSnapshotMessage(`已複製 snapshot 到 ${snapshotCloneTarget}/${snapshotCloneName || name}`);
      await refreshSnapshots();
    } catch (err) {
      setSnapshotMessage(err.message || "複製失敗");
    }
  };

  useEffect(() => {
    try {
      const parsed = JSON.parse(snapshotJson);
      setSnapshotPreviewSrc(_previewSrcFromConfig(parsed));
    } catch (err) {
      setSnapshotPreviewSrc(null);
    }
  }, [snapshotJson]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const updatePreview = async () => {
      try {
        const parsed = JSON.parse(timelineJson);
        const firstRef = _firstSnapshotRef(parsed);
        if (!firstRef) {
          setTimelinePreviewSrc(null);
          setTimelinePreviewError(null);
          return;
        }
        setTimelinePreviewError(null);
        const snapshot = await getIframeSnapshot(firstRef.client, firstRef.name, { signal: controller.signal });
        if (cancelled) return;
        const raw = snapshot.raw || snapshot.snapshot || snapshot;
        setTimelinePreviewSrc(_previewSrcFromConfig(raw));
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

  const handleLoadTimeline = async (id) => {
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
  };

  const handleSaveTimeline = async (mode) => {
    try {
      const parsed = JSON.parse(timelineJson);
      const targetId = (mode === "update" ? timelineId : parsed.id) || parsed.id;
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
  };

  const handleDeleteTimeline = async (id) => {
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
  };

  const handleCloneTimeline = async () => {
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
  };

  const handlePlayTimelinePreview = () => {
    try {
      const parsed = JSON.parse(timelineJson);
      const id = (timelineId || parsed.id || "").trim();
      if (!id) {
        setTimelinePlayError("請先設定 timeline id，並儲存後再播放");
        return;
      }
      setTimelinePlayError(null);
      setTimelinePlaySrc(_timelinePlaybackSrc(id));
    } catch (err) {
      setTimelinePlayError("JSON 解析失敗，無法播放");
    }
  };

  const handlePlayToClient = async () => {
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
  };

  const handleLoadEpisode = async (id) => {
    try {
      const data = await fetchEpisode(id, { resolve: false });
      setEpisodeId(id);
      setEpisodeJson(pretty(data.episode || data));
      setEpisodeMessage(`已載入 episode ${id}`);
    } catch (err) {
      setEpisodeMessage(err.message || "載入 episode 失敗");
    }
  };

  const handleSaveEpisode = async (mode) => {
    try {
      const parsed = JSON.parse(episodeJson);
      const targetId = (mode === "update" ? episodeId : parsed.id) || parsed.id;
      if (!targetId) {
        throw new Error("episode id 必須提供在 JSON 內或輸入框");
      }
      const payload = { ...parsed, id: targetId };
      if (mode === "update") {
        await updateEpisode(targetId, payload, { resolve: false });
      } else {
        await createEpisode(payload, { resolve: false });
      }
      setEpisodeId(targetId);
      setEpisodeMessage(`${mode === "update" ? "已更新" : "已建立"} episode ${targetId}`);
      await refreshEpisodes();
    } catch (err) {
      setEpisodeMessage(err.message || "儲存失敗");
    }
  };

  const handleDeleteEpisode = async (id) => {
    try {
      await deleteEpisode(id);
      setEpisodeMessage(`已刪除 episode ${id}`);
      await refreshEpisodes();
      if (episodeId === id) {
        setEpisodeId("");
      }
    } catch (err) {
      setEpisodeMessage(err.message || "刪除失敗");
    }
  };

  const handleCloneEpisode = async () => {
    if (!episodeId || !episodeCloneId) {
      setEpisodeMessage("請先載入 source episode 並填入 new id");
      return;
    }
    try {
      await cloneEpisode(episodeId, { new_id: episodeCloneId }, { resolve: false });
      setEpisodeMessage(`已複製 episode 為 ${episodeCloneId}`);
      await refreshEpisodes();
    } catch (err) {
      setEpisodeMessage(err.message || "複製失敗");
    }
  };

  const handlePlayEpisode = async () => {
    if (!episodeId) {
      setEpisodePlayStatus("請先載入或儲存 episode");
      return;
    }
    try {
      setEpisodePlayStatus("發送中...");
      const payload = {};
      const map = _parseTargetMap(episodeTargetMapText);
      if (map && Object.keys(map).length > 0) {
        payload.target_client_map = map;
      }
      const prefix = episodeCommandPrefix.trim();
      if (prefix) {
        payload.command_id_prefix = prefix;
      }
      const data = await playEpisode(episodeId, payload);
      setEpisodePlayStatus(`已送出（${data?.tracks?.length ?? 0} 條 track）`);
    } catch (err) {
      setEpisodePlayStatus(err.message || "播放指令失敗");
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={tabRowStyle}>
        <button
          type="button"
          style={activeTab === "snapshot" ? activeTabButtonStyle : tabButtonStyle}
          onClick={() => setActiveTab("snapshot")}
        >
          Snapshot 管理
        </button>
        <button
          type="button"
          style={activeTab === "timeline" ? activeTabButtonStyle : tabButtonStyle}
          onClick={() => setActiveTab("timeline")}
        >
          Timeline 管理
        </button>
        <button
          type="button"
          style={activeTab === "episode" ? activeTabButtonStyle : tabButtonStyle}
          onClick={() => setActiveTab("episode")}
        >
          Episode 管理
        </button>
      </div>

      {activeTab === "snapshot" && (
        <div style={boxStyle}>
          <div style={{ marginBottom: 8 }}>
            <label style={labelStyle}>Client</label>
            <input
              type="text"
              value={snapshotClient}
              onChange={(e) => setSnapshotClient(e.target.value)}
              style={{ width: "200px" }}
            />
            <button type="button" onClick={refreshSnapshots} style={{ marginLeft: 8 }}>
              重新載入列表
            </button>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: 6 }}>已有 snapshots：</div>
              <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid #ddd", padding: 8 }}>
                {snapshotList.length === 0 && <div>尚無 snapshot</div>}
                {snapshotList.map((item) => (
                  <div key={item.name} style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ flex: 1 }}>{item.name}</span>
                    <button type="button" onClick={() => handleLoadSnapshot(item.name)} style={{ marginRight: 4 }}>
                      查看
                    </button>
                    <button type="button" onClick={() => handleCloneSnapshot(item.name)} style={{ marginRight: 4 }}>
                      複製
                    </button>
                    <button type="button" onClick={() => handleDeleteSnapshot(item.name)}>刪除</button>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 8 }}>
                <div style={{ marginBottom: 4 }}>複製到：</div>
                <input
                  type="text"
                  placeholder="target client"
                  value={snapshotCloneTarget}
                  onChange={(e) => setSnapshotCloneTarget(e.target.value)}
                  style={{ width: "160px", marginRight: 4 }}
                />
                <input
                  type="text"
                  placeholder="target name (可空)"
                  value={snapshotCloneName}
                  onChange={(e) => setSnapshotCloneName(e.target.value)}
                  style={{ width: "160px", marginRight: 4 }}
                />
              </div>
            </div>
            <div style={{ flex: 1.2 }}>
              <label style={labelStyle}>Snapshot 名稱</label>
              <input
                type="text"
                value={snapshotName}
                onChange={(e) => setSnapshotName(e.target.value)}
                style={{ width: "100%", marginBottom: 8 }}
              />
              <label style={labelStyle}>JSON</label>
              <textarea
                style={{ width: "100%", height: 260, fontFamily: "monospace" }}
                value={snapshotJson}
                onChange={(e) => setSnapshotJson(e.target.value)}
              />
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" onClick={handleSaveSnapshot}>儲存/覆寫</button>
                <button
                  type="button"
                  onClick={() => {
                    setSnapshotJson(pretty(_minimalConfigPayload(snapshotClient)));
                    setSnapshotName("new_snapshot");
                  }}
                >
                  填入預設
                </button>
              </div>
            </div>
          </div>

          <div style={{ ...previewContainerStyle, width: snapshotPreviewWidth, maxWidth: "100%" }}>
            <div style={previewTitleStyle}>預覽</div>
            {snapshotPreviewSrc ? (
              <iframe
                title="snapshot-preview"
                src={snapshotPreviewSrc}
                style={{ ...snapshotPreviewIframeStyle, height: snapshotFrameHeight }}
                sandbox="allow-scripts allow-same-origin"
              />
            ) : (
              <div style={{ color: "#888" }}>無法產生預覽，請確認 JSON 內至少有一個 panel.url 或 image</div>
            )}
            <div style={resizerHitboxStyle} onMouseDown={(e) => startResize(e, "snapshot")}>
              <div style={resizerHandleStyle} />
            </div>
          </div>

          {snapshotMessage && <div style={{ marginTop: 8, color: "#444" }}>{snapshotMessage}</div>}
        </div>
      )}

      {activeTab === "timeline" && (
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
            <button type="button" onClick={refreshTimelines}>重新載入列表</button>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: 6 }}>Timeline 列表：</div>
              <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid #ddd", padding: 8 }}>
                {timelineList.length === 0 && <div>尚無 timeline</div>}
                {timelineList.map((item) => (
                  <div key={item.id} style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ flex: 1 }}>{item.id} ({item.client_id || "n/a"})</span>
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
                <button type="button" onClick={handleCloneTimeline}>複製 timeline</button>
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
                <button type="button" onClick={() => handleSaveTimeline("create")}>新增</button>
                <button type="button" onClick={() => handleSaveTimeline("update")}>覆寫</button>
                <button type="button" onClick={() => setTimelineJson(pretty(_defaultTimelinePayload(clientId || "desktop")))}>
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
                <button type="button" onClick={handlePlayToClient}>播放</button>
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
                  <button type="button" onClick={handlePlayTimelinePreview}>播放</button>
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

            <div style={resizerHitboxStyle} onMouseDown={(e) => startResize(e, "timeline")}>
              <div style={resizerHandleStyle} />
            </div>
          </div>

          {timelineMessage && <div style={{ marginTop: 8, color: "#444" }}>{timelineMessage}</div>}
        </div>
      )}

      {activeTab === "episode" && (
        <div style={boxStyle}>
          <div style={{ marginBottom: 8 }}>
            <button type="button" onClick={refreshEpisodes}>重新載入列表</button>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: 6 }}>Episode 列表：</div>
              <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid #ddd", padding: 8 }}>
                {episodeList.length === 0 && <div>尚無 episode</div>}
                {episodeList.map((item) => (
                  <div key={item.id} style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ flex: 1 }}>
                      {item.id}
                      {item.title ? `（${item.title}）` : ""} · {item.track_count ?? item.trackCount ?? item.tracks?.length ?? 0} tracks
                    </span>
                    <button type="button" onClick={() => handleLoadEpisode(item.id)} style={{ marginRight: 4 }}>
                      載入
                    </button>
                    <button type="button" onClick={() => handleDeleteEpisode(item.id)}>刪除</button>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 8 }}>
                <div style={{ marginBottom: 4 }}>複製：</div>
                <input
                  type="text"
                  placeholder="new id"
                  value={episodeCloneId}
                  onChange={(e) => setEpisodeCloneId(e.target.value)}
                  style={{ width: "160px", marginRight: 6 }}
                />
                <button type="button" onClick={handleCloneEpisode}>複製 episode</button>
              </div>
            </div>
            <div style={{ flex: 1.2 }}>
              <label style={labelStyle}>當前 episode id</label>
              <input
                type="text"
                value={episodeId}
                onChange={(e) => setEpisodeId(e.target.value)}
                placeholder="新建請輸入 id 或在 JSON 設定"
                style={{ width: "100%", marginBottom: 8 }}
              />
              <label style={labelStyle}>JSON</label>
              <textarea
                style={{ width: "100%", height: 240, fontFamily: "monospace" }}
                value={episodeJson}
                onChange={(e) => setEpisodeJson(e.target.value)}
              />
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" onClick={() => handleSaveEpisode("create")}>新增</button>
                <button type="button" onClick={() => handleSaveEpisode("update")}>覆寫</button>
                <button type="button" onClick={() => setEpisodeJson(pretty(_defaultEpisodePayload(clientId || "desktop")))}>
                  填入預設
                </button>
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <label style={{ fontWeight: 600 }}>覆寫 target map</label>
                <input
                  type="text"
                  value={episodeTargetMapText}
                  onChange={(e) => setEpisodeTargetMapText(e.target.value)}
                  placeholder="timelineA:clientX,timelineB:clientY"
                  style={{ width: 280 }}
                />
              </div>
              <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <label style={{ fontWeight: 600 }}>command 前綴</label>
                <input
                  type="text"
                  value={episodeCommandPrefix}
                  onChange={(e) => setEpisodeCommandPrefix(e.target.value)}
                  placeholder="可選，用於去重"
                  style={{ width: 200 }}
                />
                <button type="button" onClick={handlePlayEpisode}>播放 Episode</button>
                {episodePlayStatus && <span style={{ color: "#444" }}>{episodePlayStatus}</span>}
              </div>
            </div>
          </div>

          {episodeMessage && <div style={{ marginTop: 8, color: "#444" }}>{episodeMessage}</div>}
        </div>
      )}
    </div>
  );
}

function _minimalConfigPayload(targetClient) {
  return {
    layout: "grid",
    gap: 0,
    columns: 1,
    panels: [
      {
        id: "p1",
        url: "/",
        params: {},
        ratio: 1,
        label: `${targetClient || "client"} panel`,
      },
    ],
  };
}

function _defaultTimelinePayload(targetClient) {
  return {
    id: "new_timeline",
    title: "範例 timeline",
    clientId: targetClient,
    loop: false,
    steps: [
      { snapshot: `${targetClient}/snapshot_a`, duration: 5, label: "第一段" },
      { snapshot: `${targetClient}/snapshot_b`, duration: 5, label: "第二段" },
    ],
  };
}

function _defaultEpisodePayload(targetClient) {
  const clientB = targetClient === "desktop" ? "desktop2" : `${targetClient}_b`;
  return {
    id: "new_episode",
    title: "範例 Episode",
    tracks: [
      { timelineId: "timeline_a", targetClientId: targetClient },
      { timelineId: "timeline_b", targetClientId: clientB },
    ],
    tags: ["demo"],
  };
}

function _parseTargetMap(text) {
  if (!text || typeof text !== "string") return {};
  const map = {};
  text
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((entry) => {
      const [key, value] = entry.split(":").map((s) => s.trim());
      if (key && value) {
        map[key] = value;
      }
    });
  return map;
}

function _previewSrcFromConfig(config) {
  if (!config || !Array.isArray(config.panels)) return null;

  const panels = [];
  config.panels.forEach((panel, index) => {
    if (!panel || typeof panel !== "object") return;
    let src = null;
    if (panel.url) {
      src = panel.url;
    } else if (panel.image) {
      const query = new URLSearchParams({ img: panel.image, static_mode: "true" });
      if (panel.params && typeof panel.params === "object") {
        Object.entries(panel.params).forEach(([k, v]) => {
          if (v === null || v === undefined) return;
          query.set(String(k), String(v));
        });
      }
      src = `/?${query.toString()}`;
    }
    if (!src) return;
    const colSpan = panel.colSpan ?? panel.col_span;
    const rowSpan = panel.rowSpan ?? panel.row_span;
    panels.push({
      id: panel.id || `p${index + 1}`,
      src,
      ratio: panel.ratio || 1,
      label: panel.label,
      ...(colSpan ? { colSpan } : {}),
      ...(rowSpan ? { rowSpan } : {}),
    });
  });

  if (!panels.length) return null;
  const cfg = {
    layout: config.layout || "grid",
    gap: config.gap ?? 0,
    columns: config.columns ?? 1,
    panels,
  };
  const entries = buildQueryFromIframeConfig(cfg);
  if (!entries) return null;
  const qs = new URLSearchParams(entries);
  qs.set("iframe_mode", "true");
  qs.set("iframe_preview", "true");
  qs.set("client", "snapshot-preview");
  return `/?${qs.toString()}`;
}

function _timelinePlaybackSrc(timelineId) {
  if (!timelineId) return null;
  const qs = new URLSearchParams();
  qs.set("iframe_mode", "true");
  qs.set("iframe_preview", "true");
  qs.set("client", "timeline-preview");
  qs.set("iframe_timeline", timelineId);
  qs.set("ts", `${Date.now()}`);
  return `/?${qs.toString()}`;
}

function _firstSnapshotRef(timeline) {
  if (!timeline || !Array.isArray(timeline.steps)) return null;
  const firstStep = timeline.steps.find((step) => step && step.snapshot);
  if (!firstStep) return null;

  const snapshotRef = String(firstStep.snapshot || "").trim();
  if (!snapshotRef) return null;

  const timelineClient = timeline.clientId || timeline.client_id || null;
  const stepClient = firstStep.clientId || firstStep.client_id || null;
  const defaultClient = stepClient || timelineClient || null;

  if (snapshotRef.includes("/")) {
    const [clientPart, namePart] = snapshotRef.split("/", 2).map((s) => s.trim());
    if (!namePart) return null;
    return { client: clientPart || defaultClient, name: namePart };
  }

  if (!defaultClient) return null;
  return { client: defaultClient, name: snapshotRef };
}
