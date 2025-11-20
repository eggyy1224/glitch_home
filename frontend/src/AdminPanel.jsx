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
} from "./api.js";

const boxStyle = {
  border: "1px solid #ccc",
  borderRadius: 8,
  padding: 12,
  marginBottom: 16,
  background: "#fafafa",
};

const labelStyle = { display: "block", fontWeight: 600, marginBottom: 6 };

function pretty(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (err) {
    return "";
  }
}

export default function AdminPanel({ clientId }) {
  const [snapshotClient, setSnapshotClient] = useState(clientId || "desktop");
  const [snapshotList, setSnapshotList] = useState([]);
  const [snapshotName, setSnapshotName] = useState("");
  const [snapshotJson, setSnapshotJson] = useState("{\n  \"layout\": \"grid\",\n  \"gap\": 0,\n  \"columns\": 1,\n  \"panels\": [\n    { \"id\": \"p1\", \"url\": \"/\" }\n  ]\n}");
  const [snapshotMessage, setSnapshotMessage] = useState("");
  const [snapshotCloneTarget, setSnapshotCloneTarget] = useState(clientId || "desktop2");
  const [snapshotCloneName, setSnapshotCloneName] = useState("");

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

  const resolvedClientLabel = useMemo(() => snapshotClient || "(未設定)", [snapshotClient]);

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

  useEffect(() => {
    refreshSnapshots();
    refreshTimelines();
  }, []);

  const handleLoadSnapshot = async (name) => {
    try {
      const data = await getIframeSnapshot(snapshotClient, name);
      const raw = data.raw || data.snapshot || data;
      setSnapshotName(name);
      setSnapshotJson(pretty(raw));
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

  const handleLoadTimeline = async (id) => {
    try {
      const data = await fetchIframeTimeline(id, { resolve: false });
      setTimelineId(id);
      setTimelineJson(pretty(data.timeline || data));
      setTimelineMessage(`已載入 timeline ${id}`);
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
      setTimelineMessage(`${mode === "update" ? "已更新" : "已建立"} timeline ${targetId}`);
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
      await cloneIframeTimeline(timelineId, {
        new_id: timelineCloneId,
        target_client_id: timelineCloneTarget || undefined,
      }, { resolve: false });
      setTimelineMessage(`已複製 timeline 為 ${timelineCloneId}`);
      await refreshTimelines();
    } catch (err) {
      setTimelineMessage(err.message || "複製失敗");
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <h2>Snapshot 管理</h2>
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
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Snapshot 名稱</label>
            <input
              type="text"
              value={snapshotName}
              onChange={(e) => setSnapshotName(e.target.value)}
              style={{ width: "100%", marginBottom: 8 }}
            />
            <label style={labelStyle}>JSON</label>
            <textarea
              style={{ width: "100%", height: 220, fontFamily: "monospace" }}
              value={snapshotJson}
              onChange={(e) => setSnapshotJson(e.target.value)}
            />
            <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
              <button type="button" onClick={handleSaveSnapshot}>儲存/覆寫</button>
              <button type="button" onClick={() => { setSnapshotJson(pretty(_minimalConfigPayload(snapshotClient))); setSnapshotName("new_snapshot"); }}>填入預設</button>
            </div>
          </div>
        </div>
        {snapshotMessage && <div style={{ marginTop: 8, color: "#444" }}>{snapshotMessage}</div>}
      </div>

      <h2>Timeline 管理</h2>
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
          <div style={{ flex: 1 }}>
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
              <button type="button" onClick={() => setTimelineJson(pretty(_defaultTimelinePayload(clientId || "desktop")))}>填入預設</button>
            </div>
          </div>
        </div>
        {timelineMessage && <div style={{ marginTop: 8, color: "#444" }}>{timelineMessage}</div>}
      </div>
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
