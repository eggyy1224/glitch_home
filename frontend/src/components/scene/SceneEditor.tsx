import React, { useContext, useMemo } from "react";
import { AdminPanelContext } from "../../AdminPanelContext";
import {
  activeTabButtonStyle,
  boxStyle,
  columnsStyle,
  columnStyle,
  labelStyle,
  previewContainerStyle,
  previewTitleStyle,
  tabButtonStyle,
} from "../../AdminPanelStyles";
import useSceneEditor from "../../hooks/useSceneEditor";

export default function SceneEditor() {
  const { canWriteMetadata, forbidMessage, defaultClientId } = useContext(AdminPanelContext);
  const [
    {
      sceneData,
      tagsText,
      targets,
      sceneList,
      validationErrors,
      previewEntries,
      jsonText,
      message,
      snapshotOptions,
      isSaving,
      isPreviewing,
      isPlaying,
      isEnqueuing,
      queueClientId,
    },
    {
      reloadScenes,
      loadScene,
      applyDefault,
      refreshSnapshotsForClient,
      setSceneField,
      setTagsText,
      addTarget,
      removeTarget,
      setTargetField,
      validateAndPreview,
      saveScene,
      playCurrentScene,
      enqueueScene,
      setQueueClientId,
    },
  ] = useSceneEditor();

  const targetRows = useMemo(() => (targets.length ? targets : [{ client: defaultClientId || "", snapshot: "" }]), [defaultClientId, targets]);

  const updateAudioMix = (field: "left" | "right" | "mode" | "muted", value: string | boolean) => {
    const next = { ...(sceneData.audio_mix || {}) };
    if (field === "muted") {
      next.muted = Boolean(value);
    } else if (field === "mode") {
      next.mode = typeof value === "string" ? value : "";
    } else {
      const num = Number(value);
      next[field] = Number.isNaN(num) ? undefined : num;
    }
    setSceneField("audio_mix", next);
  };

  return (
    <div style={boxStyle} data-ai-id="admin.scene.editor" data-ai-section="admin.scene.editor">
      <section
        aria-label="Scene Editor 操作提示"
        data-ai-role="scene-editor.instructions"
        style={{ marginBottom: 10, padding: "8px 10px", border: "1px solid #0f4", background: "#020" }}
      >
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Scene 編輯流程</div>
        <ol style={{ margin: 0, paddingLeft: 18, color: "#82dca5", lineHeight: 1.5 }}>
          <li>步驟 1：從列表載入或套用預設，填入 id/title/tags。</li>
          <li>步驟 2：設定 targets（client + snapshot），可用下拉選單快速帶入 snapshot。</li>
          <li>步驟 3：填寫 audio_mix（0~1），按「驗證並預覽」確認解析。</li>
          <li>步驟 4：按「儲存」或「播放 / 佇列」送出，避免再手動修改 JSON。</li>
        </ol>
      </section>

      {!canWriteMetadata && (
        <div style={{ marginBottom: 10, padding: "8px 10px", background: "#2a2a2a", border: "1px solid #f39c12" }} role="alert">
          {forbidMessage || "目前為唯讀模式，表單將停用"}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <button type="button" onClick={reloadScenes} data-ai-action="scene-editor.reload">
          重新載入列表
        </button>
        <button type="button" onClick={applyDefault} data-ai-action="scene-editor.apply-default">
          套用預設 Scene
        </button>
        <span style={{ color: validationErrors.length ? "#ffb347" : "#82dca5" }}>錯誤數：{validationErrors.length}</span>
        <span style={{ color: "#82dca5" }}>狀態：{message || "待操作"}</span>
      </div>

      <div style={columnsStyle}>
        <div style={columnStyle} data-ai-section="scene-editor.left">
          <div style={{ marginBottom: 10 }}>
            <div style={{ marginBottom: 6 }}>Scene 列表</div>
            <ul
              role="list"
              data-ai-id="scene-editor.list"
              style={{ maxHeight: 200, overflowY: "auto", border: "1px solid #0f4", padding: 8, listStyle: "none", margin: 0, background: "#000" }}
            >
              {sceneList.length === 0 && <li data-ai-state="empty">尚無 scene</li>}
              {sceneList.map((item) => (
                <li
                  key={item.id}
                  style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, border: "1px solid #0f4", padding: "4px 6px" }}
                  data-ai-item={`scene:${item.id}`}
                >
                  <span style={{ flex: 1 }}>
                    {item.id}
                    {item.title ? `（${item.title}）` : ""} · {(item as { client_count?: number }).client_count ?? 0} targets
                  </span>
                  <button type="button" onClick={() => loadScene(item.id)} data-ai-action="scene-editor.load">
                    載入
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 10 }}>
            <label style={{ display: "flex", flexDirection: "column" }}>
              Scene ID
              <input
                type="text"
                value={sceneData.id || ""}
                onChange={(e) => setSceneField("id", e.target.value)}
                data-ai-field="scene-editor.id"
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column" }}>
              Title
              <input
                type="text"
                value={sceneData.title || ""}
                onChange={(e) => setSceneField("title", e.target.value)}
                data-ai-field="scene-editor.title"
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column" }}>
              Tags (以逗號分隔)
              <input
                type="text"
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                data-ai-field="scene-editor.tags"
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column" }}>
              描述
              <input
                type="text"
                value={sceneData.description || ""}
                onChange={(e) => setSceneField("description", e.target.value)}
                data-ai-field="scene-editor.description"
              />
            </label>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ ...labelStyle, display: "block" }} htmlFor="scene-notes">
              Notes / 備註
            </label>
            <textarea
              id="scene-notes"
              value={sceneData.notes || ""}
              onChange={(e) => setSceneField("notes", e.target.value)}
              rows={3}
              style={{ width: "100%" }}
              data-ai-field="scene-editor.notes"
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Audio Mix</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
              <label style={{ display: "flex", flexDirection: "column" }}>
                left (0~1)
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  value={sceneData.audio_mix?.left ?? ""}
                  onChange={(e) => updateAudioMix("left", e.target.value)}
                  data-ai-field="scene-editor.audio-left"
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column" }}>
                right (0~1)
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  value={sceneData.audio_mix?.right ?? ""}
                  onChange={(e) => updateAudioMix("right", e.target.value)}
                  data-ai-field="scene-editor.audio-right"
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column" }}>
                mode
                <input
                  type="text"
                  value={sceneData.audio_mix?.mode ?? ""}
                  onChange={(e) => updateAudioMix("mode", e.target.value)}
                  data-ai-field="scene-editor.audio-mode"
                />
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="checkbox"
                  checked={Boolean(sceneData.audio_mix?.muted)}
                  onChange={(e) => updateAudioMix("muted", e.target.checked)}
                  data-ai-field="scene-editor.audio-muted"
                />
                muted
              </label>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ fontWeight: 700 }}>Targets</div>
              <button type="button" onClick={addTarget} data-ai-action="scene-editor.add-target">
                新增 target
              </button>
            </div>
            {targetRows.map((row, index) => {
              const options = snapshotOptions[row.client] || [];
              const snapshotValue = row.snapshot?.includes("/") ? row.snapshot.split("/", 2)[1] : row.snapshot;
              return (
                <div
                  key={`target-${index}`}
                  style={{
                    border: "1px solid #0f4",
                    padding: 8,
                    marginBottom: 8,
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 8,
                    alignItems: "center",
                  }}
                  data-ai-role="scene-editor.target-row"
                >
                  <label style={{ display: "flex", flexDirection: "column" }}>
                    Client
                    <input
                      type="text"
                      value={row.client}
                      onChange={(e) => setTargetField(index, "client", e.target.value)}
                      onBlur={(e) => refreshSnapshotsForClient(e.target.value)}
                      data-ai-field={`scene-editor.target-${index}.client`}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column" }}>
                    Snapshot
                    <input
                      type="text"
                      value={row.snapshot}
                      onChange={(e) => setTargetField(index, "snapshot", e.target.value)}
                      placeholder="client/name 或 name"
                      data-ai-field={`scene-editor.target-${index}.snapshot`}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column" }}>
                    選擇 snapshot
                    <select
                      value={snapshotValue || ""}
                      onChange={(e) =>
                        setTargetField(
                          index,
                          "snapshot",
                          row.client ? `${row.client}/${e.target.value}` : e.target.value,
                        )
                      }
                      data-ai-field={`scene-editor.target-${index}.snapshot-select`}
                    >
                      <option value="">-- 選擇 --</option>
                      {options.map((opt) => (
                        <option key={`${opt.client}/${opt.name || opt.id}`} value={opt.name || opt.id}>
                          {opt.client || row.client}/{opt.name || opt.id}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <button type="button" onClick={() => refreshSnapshotsForClient(row.client)} data-ai-action="scene-editor.refresh-snapshot">
                      重新載入 snapshot
                    </button>
                    <button
                      type="button"
                      onClick={() => removeTarget(index)}
                      data-ai-action="scene-editor.remove-target"
                      disabled={targetRows.length <= 1}
                    >
                      移除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }} data-ai-role="scene-editor.actions">
            <button type="button" onClick={validateAndPreview} disabled={isPreviewing} data-ai-action="scene-editor.validate">
              {isPreviewing ? "驗證中..." : "驗證並預覽"}
            </button>
            <button
              type="button"
              onClick={saveScene}
              disabled={!canWriteMetadata || isSaving}
              data-ai-action="scene-editor.save"
              data-ai-state={isSaving ? "saving" : undefined}
            >
              {isSaving ? "儲存中..." : "儲存"}
            </button>
            <button type="button" onClick={playCurrentScene} disabled={isPlaying} data-ai-action="scene-editor.play">
              {isPlaying ? "播放中..." : "播放"}
            </button>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              Queue client
              <input
                type="text"
                value={queueClientId}
                onChange={(e) => setQueueClientId(e.target.value)}
                style={{ width: 120 }}
                data-ai-field="scene-editor.queue-client"
              />
            </label>
            <button type="button" onClick={enqueueScene} disabled={isEnqueuing} data-ai-action="scene-editor.enqueue">
              {isEnqueuing ? "排程中..." : "加入 queue"}
            </button>
          </div>
        </div>

        <div style={columnStyle} data-ai-section="scene-editor.right">
          <label style={labelStyle} htmlFor="scene-editor-json">
            JSON 預覽
          </label>
          <textarea
            id="scene-editor-json"
            value={jsonText}
            readOnly
            style={{ width: "100%", height: 180, fontFamily: "monospace" }}
            data-ai-field="scene-editor.json"
          />

          <div style={{ marginTop: 10 }} data-ai-role="scene-editor.validation">
            <div style={{ fontWeight: 700, marginBottom: 6 }}>驗證結果</div>
            {validationErrors.length === 0 ? (
              <div style={{ color: "#3aff85" }} data-ai-status="scene-editor.validation-ok">
                未發現錯誤
              </div>
            ) : (
              <ul style={{ paddingLeft: 16, color: "#ff6b6b" }} data-ai-status="scene-editor.validation-errors">
                {validationErrors.map((err, idx) => (
                  <li key={`${err.path}-${idx}`}>
                    <strong>{err.path}：</strong>
                    {err.message}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div style={{ ...previewContainerStyle, marginTop: 12 }} data-ai-section="scene-editor.preview">
            <div style={previewTitleStyle}>解析預覽（最多兩個畫面）</div>
            {previewEntries.length === 0 && (
              <div style={{ color: "#82dca5" }} data-ai-state="empty">
                尚未產生預覽，請先點「驗證並預覽」
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
              {previewEntries.slice(0, 2).map((entry, idx) => (
                <div key={`${entry.client}-${idx}`} style={{ border: "1px solid #0f4", padding: 8 }}>
                  <div style={{ marginBottom: 6, color: "#82dca5" }}>
                    {entry.client}/{entry.snapshot}
                  </div>
                  {entry.previewSrc ? (
                    <iframe
                      title={`scene-preview-${idx}`}
                      src={entry.previewSrc}
                      style={{ width: "100%", height: 240, border: "1px solid #0f4" }}
                      sandbox="allow-scripts allow-same-origin"
                      data-ai-id={`scene-editor.preview-${idx}`}
                    />
                  ) : (
                    <div style={{ color: "#ffb347" }}>{entry.error || "無法產生預覽"}</div>
                  )}
                </div>
              ))}
            </div>
            {previewEntries.length > 2 && (
              <div style={{ marginTop: 6, color: "#82dca5" }}>其餘 target 已解析（僅展示前兩個）。</div>
            )}
          </div>
        </div>
      </div>

      {message && (
        <div style={{ marginTop: 8, color: "#82dca5", letterSpacing: "0.03em" }} role="status" data-ai-status="scene-editor.message">
          {message}
        </div>
      )}
    </div>
  );
}
