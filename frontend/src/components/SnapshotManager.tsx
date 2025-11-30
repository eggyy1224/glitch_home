import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  cloneIframeSnapshot,
  deleteIframeSnapshot,
  getIframeSnapshot,
  listIframeSnapshots,
  restoreIframeSnapshot,
  saveIframeSnapshot,
} from "../api";
import { AdminPanelContext } from "../AdminPanelContext";
import { boxStyle, labelStyle, previewContainerStyle, previewTitleStyle, resizerHandleStyle, resizerHitboxStyle, snapshotPreviewIframeStyle } from "../AdminPanelStyles";
import { minimalConfigPayload, previewSrcFromConfig, pretty } from "../adminPanelUtils";
import type { SnapshotConfig } from "../types/admin";
import type { SnapshotEntry } from "../types/timeline";

export default function SnapshotManager() {
  const { defaultClientId } = useContext(AdminPanelContext);
  const defaultPreviewWidth = useMemo(() => {
    if (typeof window === "undefined") return 960;
    return Math.max(Math.min(window.innerWidth - 100, 1200), 720);
  }, []);

  const [snapshotClient, setSnapshotClient] = useState(defaultClientId || "desktop");
  const [snapshotList, setSnapshotList] = useState<SnapshotEntry[]>([]);
  const [snapshotName, setSnapshotName] = useState("");
  const [snapshotJson, setSnapshotJson] = useState(() => pretty(minimalConfigPayload(defaultClientId)));
  const [snapshotMessage, setSnapshotMessage] = useState("");
  const [snapshotCloneTarget, setSnapshotCloneTarget] = useState(() => {
    const base = defaultClientId && defaultClientId !== "admin" ? defaultClientId : "desktop";
    return base === "desktop" ? "desktop2" : base;
  });
  const [snapshotCloneName, setSnapshotCloneName] = useState("");
  const [snapshotPreviewSrc, setSnapshotPreviewSrc] = useState<string | null>(null);
  const [snapshotPreviewWidth, setSnapshotPreviewWidth] = useState<number>(defaultPreviewWidth);

  const snapshotFrameHeight = useMemo(
    () => Math.max(320, Math.round((snapshotPreviewWidth * 9) / 16)),
    [snapshotPreviewWidth],
  );
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshRequestIdRef = useRef(0);

  const clampPreviewWidth = useCallback((width: number) => {
    const max = typeof window !== "undefined" ? Math.max(window.innerWidth - 60, 640) : 1400;
    return Math.min(Math.max(width, 560), Math.min(max, 1800));
  }, []);

  const startResize = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = snapshotPreviewWidth;
      const onMove = (e: MouseEvent) => {
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

  const refreshSnapshots = useCallback(async (clientOverride?: string | null) => {
    const client = clientOverride ?? snapshotClient;
    const label = client || "(未設定)";
    const requestId = Date.now();
    refreshRequestIdRef.current = requestId;
    try {
      const data = await listIframeSnapshots(client || null);
      if (refreshRequestIdRef.current !== requestId) return;
      setSnapshotList(Array.isArray(data.snapshots) ? (data.snapshots as SnapshotEntry[]) : []);
      setSnapshotMessage(`已載入 ${data.snapshots?.length ?? 0} 筆 snapshot (${label})`);
    } catch (err) {
      if (refreshRequestIdRef.current !== requestId) return;
      setSnapshotMessage((err as Error)?.message || "載入 snapshot 失敗");
    }
  }, [snapshotClient]);

  const handleLoadSnapshot = useCallback(
    async (name: string) => {
      try {
        const data = await getIframeSnapshot(snapshotClient, name);
        const raw = (data as { raw?: unknown; snapshot?: unknown }).raw || (data as { snapshot?: unknown }).snapshot || data;
        setSnapshotName(name);
        setSnapshotJson(pretty(raw));
        setSnapshotPreviewSrc(previewSrcFromConfig(raw as Partial<SnapshotConfig>));
        setSnapshotMessage(`已載入 snapshot ${name}`);
      } catch (err) {
        setSnapshotMessage((err as Error)?.message || "載入 snapshot 失敗");
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
      setSnapshotMessage(`已儲存 snapshot ${(data as { snapshot?: { name?: string } }).snapshot?.name || snapshotName}`);
      setSnapshotPreviewSrc(previewSrcFromConfig(parsed as Partial<SnapshotConfig>));
      await refreshSnapshots();
    } catch (err) {
      setSnapshotMessage((err as Error)?.message || "儲存失敗");
    }
  }, [refreshSnapshots, snapshotClient, snapshotJson, snapshotName]);

  const handleDeleteSnapshot = useCallback(
    async (name: string) => {
      try {
        await deleteIframeSnapshot(snapshotClient, name);
        setSnapshotMessage(`已刪除 snapshot ${name}`);
        await refreshSnapshots();
        if (snapshotName === name) {
          setSnapshotName("");
        }
      } catch (err) {
        setSnapshotMessage((err as Error)?.message || "刪除失敗");
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
      setSnapshotMessage((err as Error)?.message || "複製失敗");
    }
  }, [refreshSnapshots, snapshotClient, snapshotCloneName, snapshotCloneTarget, snapshotName]);

  const handlePlaySnapshot = useCallback(
    async (name: string) => {
      const targetClient = (snapshotClient || "").trim();
      const targetSnapshot = name || snapshotName;
      if (!targetClient) {
        setSnapshotMessage("請先輸入 client 再播放");
        return;
      }
      if (!targetSnapshot) {
        setSnapshotMessage("請先選擇要播放的 snapshot");
        return;
      }
      try {
        setSnapshotMessage(`播放中 ${targetSnapshot} → ${targetClient}...`);
        await restoreIframeSnapshot(targetClient, targetSnapshot);
        setSnapshotMessage(`已送出播放：${targetSnapshot} 到 ${targetClient}`);
      } catch (err) {
        setSnapshotMessage((err as Error)?.message || "播放指令失敗");
      }
    },
    [snapshotClient, snapshotName],
  );

  useEffect(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = setTimeout(() => {
      refreshSnapshots(snapshotClient);
    }, 300);
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [refreshSnapshots, snapshotClient]);

  useEffect(() => {
    try {
      const parsed = JSON.parse(snapshotJson);
      setSnapshotPreviewSrc(previewSrcFromConfig(parsed));
    } catch (err) {
      setSnapshotPreviewSrc(null);
    }
  }, [snapshotJson]);

  return (
    <div style={boxStyle} data-ai-id="admin.snapshot.section" data-ai-role="snapshot.panel">
      <section
        aria-label="Snapshot 控制流程"
        data-ai-role="snapshot.instructions"
        style={{ marginBottom: 10, padding: "8px 10px", border: "1px solid #0f4", background: "#020" }}
      >
        <div style={{ fontWeight: 700, marginBottom: 4 }}>操作順序（給 AI/自動化）</div>
        <ol style={{ margin: 0, paddingLeft: 18, color: "#82dca5", lineHeight: 1.5 }}>
          <li data-ai-role="snapshot.step-note.client">步驟 1：填入目標 client 並重新載入列表。</li>
          <li data-ai-role="snapshot.step-note.pick">步驟 2：在列表點「載入配置」或「設為當前名稱」挑選 snapshot。</li>
          <li data-ai-role="snapshot.step-note.play">步驟 3：需要播放就按「播放到 client」，需要複製/儲存就用右側表單。</li>
          <li data-ai-role="snapshot.step-note.preview">步驟 4：確認下方預覽 iframe 是否更新，並觀察狀態訊息。</li>
        </ol>
      </section>

      <section aria-labelledby="snapshot-step-client" data-ai-role="snapshot.step.client" style={{ marginBottom: 8 }}>
        <div id="snapshot-step-client" style={{ fontWeight: 700, marginBottom: 4 }}>
          步驟 1：目標 Client
        </div>
        <label style={labelStyle} htmlFor="snapshot-client">
          Client
        </label>
        <input
          id="snapshot-client"
          name="snapshot-client"
          type="text"
          value={snapshotClient}
          onChange={(e) => setSnapshotClient(e.target.value)}
          aria-label="snapshot client id"
          data-ai-field="snapshot.client"
          style={{ width: "200px" }}
        />
        <button
          type="button"
          onClick={() => refreshSnapshots(snapshotClient)}
          style={{ marginLeft: 8 }}
          data-ai-action="snapshot.reload-list"
          data-ai-role="snapshot.action.reload"
          aria-label="重新載入 snapshot 列表"
        >
          重新載入列表
        </button>
        <div style={{ marginTop: 4, fontSize: 12, color: "#82dca5" }} data-ai-status="snapshot.client-hint">
          會將列表/預覽/播放都鎖定到此 client。
        </div>
      </section>

      <div style={{ display: "flex", gap: 12 }}>
        <section style={{ flex: 1 }} aria-labelledby="snapshot-step-pick" data-ai-role="snapshot.step.pick">
          <div id="snapshot-step-pick" style={{ marginBottom: 4, fontWeight: 700 }}>
            步驟 2：選擇/播放 snapshot
          </div>
          <div style={{ marginBottom: 6, color: "#82dca5", fontSize: 12 }}>
            「載入配置」會把 JSON 帶到右側表單並更新預覽；「設為當前名稱」只填入名稱；播放會使用上方的 client。
          </div>
          <ul
            role="list"
            aria-label="snapshot 選擇列表"
            data-ai-id="snapshot.list"
            data-ai-role="snapshot.list"
            style={{
              maxHeight: 200,
              overflowY: "auto",
              border: "1px solid #0f4",
              padding: 8,
              listStyle: "none",
              margin: 0,
              background: "#000",
            }}
          >
            {snapshotList.length === 0 && <li data-ai-state="empty">尚無 snapshot</li>}
            {snapshotList.map((item, idx) => {
              const itemName = item.name || "";
              const isSelected = snapshotName === itemName;
              return (
                <li
                  key={itemName || idx}
                  role="listitem"
                  data-ai-item={`snapshot:${itemName}`}
                  data-ai-role="snapshot.row"
                  data-ai-state={isSelected ? "selected" : "idle"}
                  aria-selected={isSelected}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginBottom: 6,
                    padding: "6px 6px",
                    borderRadius: 4,
                    background: isSelected ? "#011a0f" : "#000",
                    border: `1px solid ${isSelected ? "#3aff85" : "#0f4"}`,
                    boxShadow: isSelected ? "0 0 0 1px rgba(58, 255, 133, 0.4)" : "none",
                  }}
                >
                  <span style={{ flex: 1, fontWeight: isSelected ? 700 : 600 }}>{itemName || "(未命名)"}</span>
                <button
                  type="button"
                  onClick={() => handleLoadSnapshot(itemName)}
                  style={{ marginRight: 4 }}
                  data-ai-action="snapshot.load"
                  data-testid="snapshot-load"
                  aria-label={`查看 snapshot ${itemName}（載入到表單並預覽）`}
                >
                  查看/載入
                </button>
                  <button
                    type="button"
                    onClick={() => setSnapshotName(itemName)}
                    style={{ marginRight: 4 }}
                    data-ai-action="snapshot.select"
                    data-testid="snapshot-select"
                    aria-label={`設為當前 snapshot 名稱：${itemName}`}
                  >
                    設為當前名稱
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePlaySnapshot(itemName)}
                    style={{ marginRight: 4 }}
                    data-ai-action="snapshot.play"
                    data-testid="snapshot-play"
                    aria-label={`播放 snapshot ${itemName} 到 client ${snapshotClient || "(未指定)"}`}
                  >
                    播放到 client
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteSnapshot(itemName)}
                    data-ai-action="snapshot.delete"
                    data-testid="snapshot-delete"
                    aria-label={`刪除 snapshot ${itemName}`}
                    data-ai-danger="true"
                  >
                    刪除
                  </button>
                </li>
              );
            })}
          </ul>
          <div style={{ marginTop: 6, fontSize: 12, color: "#82dca5" }} data-ai-status="snapshot.current-selection">
            目前表單名稱：{snapshotName || "（尚未選擇）"}
          </div>
          <div style={{ marginTop: 8 }} data-ai-role="snapshot.clone">
            <div style={{ marginBottom: 4 }}>複製到（會留存於 server）：</div>
            <input
              type="text"
              placeholder="target client"
              value={snapshotCloneTarget}
              onChange={(e) => setSnapshotCloneTarget(e.target.value)}
              style={{ width: "160px", marginRight: 4 }}
              data-ai-field="snapshot.clone.target-client"
              aria-label="複製目標 client"
            />
            <input
              type="text"
              placeholder="target name (可空)"
              value={snapshotCloneName}
              onChange={(e) => setSnapshotCloneName(e.target.value)}
              style={{ width: "160px", marginRight: 4 }}
              data-ai-field="snapshot.clone.target-name"
              aria-label="複製目標名稱"
            />
            <button type="button" onClick={handleCloneSnapshot} data-ai-action="snapshot.clone" aria-label="複製 snapshot">
              複製 snapshot
            </button>
          </div>
        </section>

        <section style={{ flex: 1.2 }} aria-labelledby="snapshot-step-edit" data-ai-role="snapshot.step.edit">
          <div id="snapshot-step-edit" style={{ marginBottom: 4, fontWeight: 700 }}>
            步驟 3：編輯 / 儲存
          </div>
          <label style={labelStyle} htmlFor="snapshot-name">
            Snapshot 名稱
          </label>
          <input
            id="snapshot-name"
            name="snapshot-name"
            type="text"
            value={snapshotName}
            onChange={(e) => setSnapshotName(e.target.value)}
            style={{ width: "100%", marginBottom: 8 }}
            data-ai-field="snapshot.name"
          />
          <label style={labelStyle} htmlFor="snapshot-json">
            JSON
          </label>
          <textarea
            id="snapshot-json"
            name="snapshot-json"
            style={{ width: "100%", height: 260, fontFamily: "monospace" }}
            value={snapshotJson}
            onChange={(e) => setSnapshotJson(e.target.value)}
            data-ai-field="snapshot.json"
            aria-label="snapshot JSON"
          />
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={handleSaveSnapshot} data-ai-action="snapshot.save" data-testid="snapshot-save" aria-label="儲存或覆寫 snapshot">
              儲存/覆寫
            </button>
            <button
              type="button"
              onClick={() => {
                setSnapshotJson(pretty(minimalConfigPayload(snapshotClient)));
                setSnapshotName("new_snapshot");
              }}
              data-ai-action="snapshot.fill-default"
              data-testid="snapshot-fill-default"
              aria-label="填入預設 snapshot JSON"
            >
              填入預設
            </button>
          </div>
        </section>
      </div>

      <section
        style={{ ...previewContainerStyle, width: snapshotPreviewWidth, maxWidth: "100%" }}
        data-ai-section="snapshot.preview"
        data-ai-role="snapshot.preview"
        aria-label="Snapshot 預覽區塊"
      >
        <div style={previewTitleStyle}>預覽</div>
        {snapshotPreviewSrc ? (
          <iframe
            title="preview-main"
            src={snapshotPreviewSrc}
            style={{ ...snapshotPreviewIframeStyle, height: snapshotFrameHeight }}
            sandbox="allow-scripts allow-same-origin"
            data-ai-id="snapshot.preview.iframe"
            data-testid="snapshot-preview-iframe"
          />
        ) : (
          <div style={{ color: "#82dca5" }} data-ai-state="empty" data-ai-role="snapshot.preview-empty">
            無法產生預覽，請確認 JSON 內至少有一個 panel.url 或 image
          </div>
        )}
        <div style={resizerHitboxStyle} onMouseDown={startResize} aria-hidden="true" data-ai-role="snapshot.preview-resizer">
          <div style={resizerHandleStyle} />
        </div>
      </section>

      {snapshotMessage && (
        <div
          style={{ marginTop: 8, color: "#82dca5", letterSpacing: "0.03em" }}
          role="status"
          aria-live="polite"
          data-ai-status="snapshot.message"
          data-ai-role="snapshot.status"
        >
          {snapshotMessage}
        </div>
      )}
    </div>
  );
}
