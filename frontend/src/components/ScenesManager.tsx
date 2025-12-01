import React, { useCallback, useContext, useEffect, useState } from "react";
import {
  cloneScene,
  createScene,
  deleteScene,
  fetchScene,
  listScenes,
  playScene,
  updateScene,
} from "../api";
import { AdminPanelContext } from "../AdminPanelContext";
import { boxStyle, labelStyle } from "../AdminPanelStyles";
import { defaultScenePayload, pretty } from "../adminPanelUtils";
import type { Scene } from "../types/scene";

export default function ScenesManager() {
  const { defaultClientId } = useContext(AdminPanelContext);
  const [sceneList, setSceneList] = useState<Scene[]>([]);
  const [sceneId, setSceneId] = useState("");
  const [sceneJson, setSceneJson] = useState(() => pretty(defaultScenePayload(defaultClientId)));
  const [sceneMessage, setSceneMessage] = useState("");
  const [sceneCloneId, setSceneCloneId] = useState("");
  const [scenePlayStatus, setScenePlayStatus] = useState("");

  const refreshScenes = useCallback(async () => {
    try {
      const data = await listScenes();
      setSceneList(Array.isArray(data.scenes) ? (data.scenes as Scene[]) : []);
      setSceneMessage(`已載入 ${data.scenes?.length ?? 0} 筆 scene`);
    } catch (err) {
      setSceneMessage((err as Error)?.message || "載入 scene 失敗");
    }
  }, []);

  const handleLoadScene = useCallback(async (id: string) => {
    try {
      const data = await fetchScene(id, { resolve: false });
      setSceneId(id);
      setSceneJson(pretty((data as { scene?: unknown }).scene || data));
      setSceneMessage(`已載入 scene ${id}`);
    } catch (err) {
      setSceneMessage((err as Error)?.message || "載入 scene 失敗");
    }
  }, []);

  const handleSaveScene = useCallback(
    async (mode: "create" | "update") => {
      try {
        const parsed = JSON.parse(sceneJson);
        const inputId = (sceneId || "").trim();
        const targetId = (mode === "update" ? inputId || parsed.id : parsed.id || inputId) || parsed.id;
        if (!targetId) {
          throw new Error("scene id 必須提供在 JSON 內或輸入框");
        }
        const payload = { ...parsed, id: targetId };
        if (mode === "update") {
          await updateScene(targetId, payload, { resolve: false });
        } else {
          await createScene(payload, { resolve: false });
        }
        setSceneId(targetId);
        setSceneMessage(`${mode === "update" ? "已更新" : "已建立"} scene ${targetId}`);
        await refreshScenes();
      } catch (err) {
        setSceneMessage((err as Error)?.message || "儲存失敗");
      }
    },
    [refreshScenes, sceneId, sceneJson],
  );

  const handleDeleteScene = useCallback(
    async (id: string) => {
      try {
        await deleteScene(id);
        setSceneMessage(`已刪除 scene ${id}`);
        await refreshScenes();
        if (sceneId === id) {
          setSceneId("");
        }
      } catch (err) {
        setSceneMessage((err as Error)?.message || "刪除失敗");
      }
    },
    [refreshScenes, sceneId],
  );

  const handleCloneScene = useCallback(async () => {
    if (!sceneId || !sceneCloneId) {
      setSceneMessage("請先載入 source scene 並填入 new id");
      return;
    }
    try {
      await cloneScene(sceneId, { new_id: sceneCloneId }, { resolve: false });
      setSceneMessage(`已複製 scene 為 ${sceneCloneId}`);
      await refreshScenes();
    } catch (err) {
      setSceneMessage((err as Error)?.message || "複製失敗");
    }
  }, [refreshScenes, sceneCloneId, sceneId]);

  const handlePlayScene = useCallback(async () => {
    if (!sceneId) {
      setScenePlayStatus("請先載入或儲存 scene");
      return;
    }
    try {
      setScenePlayStatus("發送中...");
      await playScene(sceneId, {});
      setScenePlayStatus("已送出播放");
    } catch (err) {
      setScenePlayStatus((err as Error)?.message || "播放指令失敗");
    }
  }, [sceneId]);

  useEffect(() => {
    refreshScenes();
  }, [refreshScenes]);

  return (
    <div style={boxStyle} data-ai-id="admin.scene.section">
      <div style={{ marginBottom: 8 }}>
        <button type="button" onClick={refreshScenes} data-ai-action="scene.reload-list" aria-label="重新載入 scene 列表">
          重新載入列表
        </button>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: 6 }}>Scene 列表：</div>
          <ul
            role="list"
            data-ai-id="scene.list"
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
            {sceneList.length === 0 && <li data-ai-state="empty">尚無 scene</li>}
            {sceneList.map((item) => {
              const itemId = item.id || "";
              const clientCount = (item as { client_count?: number }).client_count ?? 0;
              return (
                <li
                  key={itemId || Math.random()}
                  role="listitem"
                  data-ai-item={`scene:${itemId}`}
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
                    {item.title ? `（${item.title}）` : ""} · {clientCount} targets
                  </span>
                  <button
                    type="button"
                    onClick={() => handleLoadScene(itemId)}
                    style={{ marginRight: 4 }}
                    data-ai-action="scene.load"
                    aria-label={`載入 scene ${itemId}`}
                  >
                    載入
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteScene(itemId)}
                    data-ai-action="scene.delete"
                    aria-label={`刪除 scene ${itemId}`}
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
            <label style={labelStyle} htmlFor="scene-id">
              Scene ID
            </label>
            <input
              id="scene-id"
              type="text"
              value={sceneId}
              onChange={(e) => setSceneId(e.target.value)}
              placeholder="scene id"
              data-ai-field="scene.id"
              style={{ width: "100%" }}
            />
          </div>
          <div style={{ marginBottom: 6 }}>
            <label style={labelStyle} htmlFor="scene-json">
              Scene JSON
            </label>
            <textarea
              id="scene-json"
              value={sceneJson}
              onChange={(e) => setSceneJson(e.target.value)}
              rows={16}
              style={{ width: "100%" }}
              data-ai-field="scene.json"
            />
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button type="button" onClick={() => handleSaveScene("create")} data-ai-action="scene.create">
              建立
            </button>
            <button type="button" onClick={() => handleSaveScene("update")} data-ai-action="scene.update">
              更新
            </button>
            <button type="button" onClick={handleCloneScene} data-ai-action="scene.clone">
              複製
            </button>
            <input
              type="text"
              placeholder="new id"
              value={sceneCloneId}
              onChange={(e) => setSceneCloneId(e.target.value)}
              style={{ minWidth: 120 }}
              data-ai-field="scene.clone-target"
            />
            <button type="button" onClick={handlePlayScene} data-ai-action="scene.play">
              播放
            </button>
          </div>
          <div style={{ marginTop: 8, color: "#82dca5" }} data-ai-status="scene.message">
            {sceneMessage}
          </div>
          <div style={{ marginTop: 4, color: "#c8ffd2" }} data-ai-status="scene.play-status">
            {scenePlayStatus}
          </div>
        </div>
      </div>
    </div>
  );
}
