import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  cloneIframeSnapshot,
  deleteIframeSnapshot,
  getIframeSnapshot,
  listIframeSnapshots,
  saveIframeSnapshot,
} from "../api.js";
import { AdminPanelContext } from "../AdminPanelContext";
import { boxStyle, labelStyle, previewContainerStyle, previewTitleStyle, resizerHandleStyle, resizerHitboxStyle, snapshotPreviewIframeStyle } from "../AdminPanelStyles.js";
import { minimalConfigPayload, previewSrcFromConfig, pretty } from "../adminPanelUtils.js";

export default function SnapshotManager() {
  const { defaultClientId } = useContext(AdminPanelContext);
  const defaultPreviewWidth = useMemo(() => {
    if (typeof window === "undefined") return 960;
    return Math.max(Math.min(window.innerWidth - 100, 1200), 720);
  }, []);

  const [snapshotClient, setSnapshotClient] = useState(defaultClientId);
  const [snapshotList, setSnapshotList] = useState([]);
  const [snapshotName, setSnapshotName] = useState("");
  const [snapshotJson, setSnapshotJson] = useState(() => pretty(minimalConfigPayload(defaultClientId)));
  const [snapshotMessage, setSnapshotMessage] = useState("");
  const [snapshotCloneTarget, setSnapshotCloneTarget] = useState(defaultClientId || "desktop2");
  const [snapshotCloneName, setSnapshotCloneName] = useState("");
  const [snapshotPreviewSrc, setSnapshotPreviewSrc] = useState(null);
  const [snapshotPreviewWidth, setSnapshotPreviewWidth] = useState(defaultPreviewWidth);

  const resolvedClientLabel = useMemo(() => snapshotClient || "(未設定)", [snapshotClient]);
  const snapshotFrameHeight = useMemo(
    () => Math.max(320, Math.round((snapshotPreviewWidth * 9) / 16)),
    [snapshotPreviewWidth],
  );

  const clampPreviewWidth = useCallback((width) => {
    const max = typeof window !== "undefined" ? Math.max(window.innerWidth - 60, 640) : 1400;
    return Math.min(Math.max(width, 560), Math.min(max, 1800));
  }, []);

  const startResize = useCallback(
    (event) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = snapshotPreviewWidth;
      const onMove = (e) => {
        const delta = e.clientX - startX;
        setSnapshotPreviewWidth(clampPreviewWidth(startWidth + delta));
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [clampPreviewWidth, snapshotPreviewWidth],
  );

  const refreshSnapshots = useCallback(async () => {
    try {
      const data = await listIframeSnapshots(snapshotClient || null);
      setSnapshotList(Array.isArray(data.snapshots) ? data.snapshots : []);
      setSnapshotMessage(`已載入 ${data.snapshots?.length ?? 0} 筆 snapshot (${resolvedClientLabel})`);
    } catch (err) {
      setSnapshotMessage(err.message || "載入 snapshot 失敗");
    }
  }, [resolvedClientLabel, snapshotClient]);

  const handleLoadSnapshot = useCallback(
    async (name) => {
      try {
        const data = await getIframeSnapshot(snapshotClient, name);
        const raw = data.raw || data.snapshot || data;
        setSnapshotName(name);
        setSnapshotJson(pretty(raw));
        setSnapshotPreviewSrc(previewSrcFromConfig(raw));
        setSnapshotMessage(`已載入 snapshot ${name}`);
      } catch (err) {
        setSnapshotMessage(err.message || "載入 snapshot 失敗");
      }
    },
    [snapshotClient],
  );

  const handleSaveSnapshot = useCallback(async () => {
    if (!snapshotName.trim()) {
      setSnapshotMessage("請輸入 snapshot 名稱");
      return;
    }
    try {
      const parsed = JSON.parse(snapshotJson);
      const data = await saveIframeSnapshot(snapshotClient, snapshotName.trim(), parsed);
      setSnapshotMessage(`已儲存 snapshot ${data.snapshot?.name || snapshotName}`);
      setSnapshotPreviewSrc(previewSrcFromConfig(parsed));
      await refreshSnapshots();
    } catch (err) {
      setSnapshotMessage(err.message || "儲存失敗");
    }
  }, [refreshSnapshots, snapshotClient, snapshotJson, snapshotName]);

  const handleDeleteSnapshot = useCallback(
    async (name) => {
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
    },
    [refreshSnapshots, snapshotClient, snapshotName],
  );

  const handleCloneSnapshot = useCallback(async () => {
    try {
      await cloneIframeSnapshot(snapshotClient, snapshotName || "", {
        target_client: snapshotCloneTarget,
        target_name: snapshotCloneName || snapshotName || undefined,
      });
      setSnapshotMessage(`已複製 snapshot 到 ${snapshotCloneTarget}/${snapshotCloneName || snapshotName || ""}`);
      await refreshSnapshots();
    } catch (err) {
      setSnapshotMessage(err.message || "複製失敗");
    }
  }, [refreshSnapshots, snapshotClient, snapshotCloneName, snapshotCloneTarget, snapshotName]);

  useEffect(() => {
    refreshSnapshots();
  }, [refreshSnapshots]);

  useEffect(() => {
    try {
      const parsed = JSON.parse(snapshotJson);
      setSnapshotPreviewSrc(previewSrcFromConfig(parsed));
    } catch (err) {
      setSnapshotPreviewSrc(null);
    }
  }, [snapshotJson]);

  return (
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
                <button type="button" onClick={() => setSnapshotName(item.name)} style={{ marginRight: 4 }}>
                  選擇
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
            <button type="button" onClick={handleCloneSnapshot}>
              複製 snapshot
            </button>
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
            <button type="button" onClick={handleSaveSnapshot}>
              儲存/覆寫
            </button>
            <button
              type="button"
              onClick={() => {
                setSnapshotJson(pretty(minimalConfigPayload(snapshotClient)));
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
        <div style={resizerHitboxStyle} onMouseDown={startResize}>
          <div style={resizerHandleStyle} />
        </div>
      </div>

      {snapshotMessage && <div style={{ marginTop: 8, color: "#444" }}>{snapshotMessage}</div>}
    </div>
  );
}
