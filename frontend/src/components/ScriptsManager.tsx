import React, { useCallback, useContext, useEffect, useState } from "react";
import {
  cloneScript,
  createScript,
  deleteScript,
  fetchScript,
  listScripts,
  playScript,
  publishScript,
  rollbackScript,
  stopScript,
  updateScript,
} from "../api";
import { AdminPanelContext } from "../AdminPanelContext";
import { boxStyle, labelStyle } from "../AdminPanelStyles";
import { defaultScriptPayload, pretty } from "../adminPanelUtils";
import type { Script } from "../types/scene";

export default function ScriptsManager() {
  const { defaultClientId } = useContext(AdminPanelContext);
  const [scriptList, setScriptList] = useState<Script[]>([]);
  const [scriptId, setScriptId] = useState("");
  const [scriptJson, setScriptJson] = useState(() => pretty(defaultScriptPayload(defaultClientId)));
  const [scriptMessage, setScriptMessage] = useState("");
  const [scriptCloneId, setScriptCloneId] = useState("");
  const [scriptPlayStatus, setScriptPlayStatus] = useState("");
  const [allowDraftPlay, setAllowDraftPlay] = useState(false);
  const [loadVersion, setLoadVersion] = useState("");
  const [rollbackVersion, setRollbackVersion] = useState("");

  const refreshScripts = useCallback(async () => {
    try {
      const data = await listScripts();
      setScriptList(Array.isArray(data.scripts) ? (data.scripts as Script[]) : []);
      setScriptMessage(`已載入 ${data.scripts?.length ?? 0} 筆 script`);
    } catch (err) {
      setScriptMessage((err as Error)?.message || "載入 script 失敗");
    }
  }, []);

  const handleLoadScript = useCallback(async (id: string) => {
    try {
      const version = parseInt(loadVersion, 10);
      const versionOpt = Number.isFinite(version) ? { version } : {};
      const data = await fetchScript(id, { resolve: false, ...versionOpt });
      setScriptId(id);
      setScriptJson(pretty((data as { script?: unknown }).script || data));
      setScriptMessage(`已載入 script ${id}${versionOpt.version ? ` (v${versionOpt.version})` : ""}`);
    } catch (err) {
      setScriptMessage((err as Error)?.message || "載入 script 失敗");
    }
  }, [loadVersion]);

  const handleSaveScript = useCallback(
    async (mode: "create" | "update") => {
      try {
        const parsed = JSON.parse(scriptJson);
        const inputId = (scriptId || "").trim();
        const targetId = (mode === "update" ? inputId || parsed.id : parsed.id || inputId) || parsed.id;
        if (!targetId) {
          throw new Error("script id 必須提供在 JSON 內或輸入框");
        }
        const payload = { ...parsed, id: targetId };
        if (mode === "update") {
          await updateScript(targetId, payload, { resolve: false });
        } else {
          await createScript(payload, { resolve: false });
        }
        setScriptId(targetId);
        setScriptMessage(`${mode === "update" ? "已更新" : "已建立"} script ${targetId}`);
        await refreshScripts();
      } catch (err) {
        setScriptMessage((err as Error)?.message || "儲存失敗");
      }
    },
    [refreshScripts, scriptId, scriptJson],
  );

  const handleDeleteScript = useCallback(
    async (id: string) => {
      try {
        await deleteScript(id);
        setScriptMessage(`已刪除 script ${id}`);
        await refreshScripts();
        if (scriptId === id) {
          setScriptId("");
        }
      } catch (err) {
        setScriptMessage((err as Error)?.message || "刪除失敗");
      }
    },
    [refreshScripts, scriptId],
  );

  const handleCloneScript = useCallback(async () => {
    if (!scriptId || !scriptCloneId) {
      setScriptMessage("請先載入 source script 並填入 new id");
      return;
    }
    try {
      await cloneScript(scriptId, { new_id: scriptCloneId }, { resolve: false });
      setScriptMessage(`已複製 script 為 ${scriptCloneId}`);
      await refreshScripts();
    } catch (err) {
      setScriptMessage((err as Error)?.message || "複製失敗");
    }
  }, [refreshScripts, scriptCloneId, scriptId]);

  const handlePlayScript = useCallback(async () => {
    if (!scriptId) {
      setScriptPlayStatus("請先載入或儲存 script");
      return;
    }
    try {
      setScriptPlayStatus("發送中...");
      await playScript(scriptId, {}, { allowDraft: allowDraftPlay });
      setScriptPlayStatus("已送出播放");
    } catch (err) {
      setScriptPlayStatus((err as Error)?.message || "播放指令失敗");
    }
  }, [allowDraftPlay, scriptId]);

  const currentScriptVersion = useCallback((): number | null => {
    try {
      const parsed = JSON.parse(scriptJson);
      const v = (parsed as { version?: unknown }).version;
      return typeof v === "number" ? v : null;
    } catch {
      return null;
    }
  }, [scriptJson]);

  const handlePublishScript = useCallback(async () => {
    if (!scriptId) {
      setScriptMessage("請先載入 script");
      return;
    }
    const expected = currentScriptVersion();
    try {
      await publishScript(scriptId, {}, { expectedVersion: expected ?? undefined });
      setScriptMessage("已發布 script");
      await handleLoadScript(scriptId);
      await refreshScripts();
    } catch (err) {
      setScriptMessage((err as Error)?.message || "發布失敗");
    }
  }, [currentScriptVersion, handleLoadScript, refreshScripts, scriptId]);

  const handleRollbackScript = useCallback(async () => {
    if (!scriptId) {
      setScriptMessage("請先載入 script");
      return;
    }
    const targetVersion = parseInt(rollbackVersion, 10);
    if (!Number.isFinite(targetVersion)) {
      setScriptMessage("請輸入要回滾的版本號");
      return;
    }
    const expected = currentScriptVersion();
    try {
      await rollbackScript(scriptId, { version: targetVersion }, { expectedVersion: expected ?? undefined });
      setScriptMessage(`已回滾到版本 ${targetVersion}`);
      setRollbackVersion("");
      await handleLoadScript(scriptId);
      await refreshScripts();
    } catch (err) {
      setScriptMessage((err as Error)?.message || "回滾失敗");
    }
  }, [currentScriptVersion, handleLoadScript, refreshScripts, rollbackVersion, scriptId]);

  const handleStopScript = useCallback(async () => {
    if (!scriptId) {
      setScriptPlayStatus("請先指定 script id");
      return;
    }
    try {
      await stopScript(scriptId);
      setScriptPlayStatus("已送出停止");
    } catch (err) {
      setScriptPlayStatus((err as Error)?.message || "停止失敗");
    }
  }, [scriptId]);

  useEffect(() => {
    refreshScripts();
  }, [refreshScripts]);

  return (
    <div style={boxStyle} data-ai-id="admin.script.section">
      <div style={{ marginBottom: 8 }}>
        <button type="button" onClick={refreshScripts} data-ai-action="script.reload-list" aria-label="重新載入 script 列表">
          重新載入列表
        </button>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: 6 }}>Script 列表：</div>
          <ul
            role="list"
            data-ai-id="script.list"
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
            {scriptList.length === 0 && <li data-ai-state="empty">尚無 script</li>}
            {scriptList.map((item) => {
              const itemId = item.id || "";
              const entryCount = (item as { entry_count?: number }).entry_count ?? (Array.isArray(item.entries) ? item.entries.length : 0);
              const version = (item as { version?: number }).version;
              const status = (item as { status?: string }).status;
              const updatedAt = (item as { updated_at?: string }).updated_at;
              return (
                <li
                  key={itemId || Math.random()}
                  role="listitem"
                  data-ai-item={`script:${itemId}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginBottom: 6,
                    padding: "4px 4px",
                    background: "#000",
                    border: "1px solid #0f4",
                  }}
                >
                  <span style={{ flex: 1 }}>
                    {itemId}
                    {item.title ? `（${item.title}）` : ""} · {entryCount} entries · v{version ?? "?"}
                    {status ? ` / ${status}` : ""}
                    {updatedAt ? ` / ${updatedAt}` : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleLoadScript(itemId)}
                    style={{ marginRight: 4 }}
                    data-ai-action="script.load"
                    aria-label={`載入 script ${itemId}`}
                  >
                    載入
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteScript(itemId)}
                    data-ai-action="script.delete"
                    aria-label={`刪除 script ${itemId}`}
                    data-ai-danger="true"
                  >
                    刪除
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: 6 }}>
            <label style={labelStyle} htmlFor="script-id">
              Script ID
            </label>
            <input
              id="script-id"
              type="text"
              value={scriptId}
              onChange={(e) => setScriptId(e.target.value)}
              placeholder="script id"
              data-ai-field="script.id"
              style={{ width: "100%" }}
            />
            <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
              <input
                type="text"
                placeholder="版本號（可選）"
                value={loadVersion}
                onChange={(e) => setLoadVersion(e.target.value)}
                style={{ width: "50%" }}
                data-ai-field="script.load-version"
              />
              <button
                type="button"
                onClick={() => {
                  if (scriptId) {
                    void handleLoadScript(scriptId);
                  } else {
                    setScriptMessage("請輸入 script id 後再載入");
                  }
                }}
                data-ai-action="script.load-version"
              >
                載入指定版
              </button>
            </div>
          </div>
          <div style={{ marginBottom: 6 }}>
            <label style={labelStyle} htmlFor="script-json">
              Script JSON
            </label>
            <textarea
              id="script-json"
              value={scriptJson}
              onChange={(e) => setScriptJson(e.target.value)}
              rows={16}
              style={{ width: "100%" }}
              data-ai-field="script.json"
            />
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button type="button" onClick={() => handleSaveScript("create")} data-ai-action="script.create">
              建立
            </button>
            <button type="button" onClick={() => handleSaveScript("update")} data-ai-action="script.update">
              更新
            </button>
            <button type="button" onClick={handlePublishScript} data-ai-action="script.publish">
              發布
            </button>
            <button type="button" onClick={handleCloneScript} data-ai-action="script.clone">
              複製
            </button>
            <input
              type="text"
              placeholder="new id"
              value={scriptCloneId}
              onChange={(e) => setScriptCloneId(e.target.value)}
              style={{ minWidth: 120 }}
              data-ai-field="script.clone-target"
            />
            <button type="button" onClick={handlePlayScript} data-ai-action="script.play">
              播放
            </button>
            <button type="button" onClick={handleStopScript} data-ai-action="script.stop">
              停止
            </button>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <input
                type="checkbox"
                checked={allowDraftPlay}
                onChange={(e) => setAllowDraftPlay(e.target.checked)}
                data-ai-field="script.allow-draft"
              />
              允許草稿
            </label>
            <input
              type="text"
              placeholder="回滾版本號"
              value={rollbackVersion}
              onChange={(e) => setRollbackVersion(e.target.value)}
              style={{ minWidth: 120 }}
              data-ai-field="script.rollback-version"
            />
            <button type="button" onClick={handleRollbackScript} data-ai-action="script.rollback">
              回滾
            </button>
          </div>
          <div style={{ marginTop: 8, color: "#82dca5" }} data-ai-status="script.message">
            {scriptMessage}
          </div>
          <div style={{ marginTop: 4, color: "#c8ffd2" }} data-ai-status="script.play-status">
            {scriptPlayStatus}
          </div>
        </div>
      </div>
    </div>
  );
}
