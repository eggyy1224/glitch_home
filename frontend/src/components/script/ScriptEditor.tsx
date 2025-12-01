import React, { useContext, useMemo } from "react";
import { AdminPanelContext } from "../../AdminPanelContext";
import { activeTabButtonStyle, boxStyle, columnsStyle, columnStyle, labelStyle, previewContainerStyle, previewTitleStyle, tabButtonStyle } from "../../AdminPanelStyles";
import useScriptEditor from "../../hooks/useScriptEditor";

export default function ScriptEditor() {
  const { canWriteMetadata, forbidMessage, defaultClientId } = useContext(AdminPanelContext);
  const [
    {
      scriptData,
      entries,
      scenes,
      scripts,
      snapshotOptions,
      tagsText,
      message,
      jsonText,
      totalDuration,
      validationErrors,
      previewEntries,
      isSaving,
      isPreviewing,
      isPlaying,
      isEnqueuing,
      queueClientId,
    },
    {
      reloadScripts,
      reloadScenes,
      loadScript,
      applyDefault,
      refreshSnapshotsForClient,
      setScriptField,
      setTagsText,
      setEntryField,
      setEntryAudioField,
      addEntry,
      removeEntry,
      duplicateEntry,
      moveEntry,
      validateAndPreview,
      saveScript,
      playCurrentScript,
      enqueueScript,
      setQueueClientId,
    },
  ] = useScriptEditor();

  const entryRows = useMemo(() => (entries.length ? entries : [{ type: "scene", scene_id: "", duration: 5 }]), [entries]);

  return (
    <div style={boxStyle} data-ai-id="admin.script.editor" data-ai-section="admin.script.editor">
      <section
        aria-label="Script Editor 操作提示"
        data-ai-role="script-editor.instructions"
        style={{ marginBottom: 10, padding: "8px 10px", border: "1px solid #0f4", background: "#020" }}
      >
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Script 編輯流程</div>
        <ol style={{ margin: 0, paddingLeft: 18, color: "#82dca5", lineHeight: 1.5 }}>
          <li>步驟 1：載入或套用預設，填入 id/title/tags。</li>
          <li>步驟 2：編輯 entries（scene 或 snapshot_pair），可用下拉選擇 scene 與 snapshot。</li>
          <li>步驟 3：按「驗證並預覽」確認 resolve 結果與總長度。</li>
          <li>步驟 4：儲存、播放或排程 queue。</li>
        </ol>
      </section>

      {!canWriteMetadata && (
        <div style={{ marginBottom: 10, padding: "8px 10px", background: "#2a2a2a", border: "1px solid #f39c12" }} role="alert">
          {forbidMessage || "目前為唯讀模式，表單將停用"}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <button type="button" onClick={reloadScripts} data-ai-action="script-editor.reload">
          重新載入列表
        </button>
        <button type="button" onClick={applyDefault} data-ai-action="script-editor.apply-default">
          套用預設 Script
        </button>
        <span style={{ color: "#82dca5" }}>狀態：{message || "待操作"}</span>
        <span style={{ color: validationErrors.length ? "#ffb347" : "#82dca5" }}>錯誤數：{validationErrors.length}</span>
        <span style={{ color: "#82dca5" }}>總長度：{totalDuration}s</span>
      </div>

      <div style={columnsStyle}>
        <div style={columnStyle} data-ai-section="script-editor.left">
          <div style={{ marginBottom: 10 }}>
            <div style={{ marginBottom: 6 }}>Script 列表</div>
            <ul
              role="list"
              data-ai-id="script-editor.list"
              style={{ maxHeight: 200, overflowY: "auto", border: "1px solid #0f4", padding: 8, listStyle: "none", margin: 0, background: "#000" }}
            >
              {scripts.length === 0 && <li data-ai-state="empty">尚無 script</li>}
              {scripts.map((item) => {
                const entryCount = (item as { entry_count?: number }).entry_count ?? (Array.isArray(item.entries) ? item.entries.length : 0);
                return (
                  <li
                    key={item.id}
                    style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, border: "1px solid #0f4", padding: "4px 6px" }}
                    data-ai-item={`script:${item.id}`}
                  >
                    <span style={{ flex: 1 }}>
                      {item.id}
                      {item.title ? `（${item.title}）` : ""} · {entryCount} entries
                    </span>
                    <button type="button" onClick={() => loadScript(item.id)} data-ai-action="script-editor.load">
                      載入
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 10 }}>
            <label style={{ display: "flex", flexDirection: "column" }}>
              Script ID
              <input
                type="text"
                value={scriptData.id || ""}
                onChange={(e) => setScriptField("id", e.target.value)}
                data-ai-field="script-editor.id"
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column" }}>
              Title
              <input
                type="text"
                value={scriptData.title || ""}
                onChange={(e) => setScriptField("title", e.target.value)}
                data-ai-field="script-editor.title"
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column" }}>
              Tags (逗號分隔)
              <input
                type="text"
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                data-ai-field="script-editor.tags"
              />
            </label>
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ ...labelStyle, display: "block" }} htmlFor="script-notes">
              描述 / 備註
            </label>
            <textarea
              id="script-notes"
              value={scriptData.description || ""}
              onChange={(e) => setScriptField("description", e.target.value)}
              rows={2}
              style={{ width: "100%", marginBottom: 6 }}
              data-ai-field="script-editor.description"
            />
            <textarea
              value={scriptData.notes || ""}
              onChange={(e) => setScriptField("notes", e.target.value)}
              rows={2}
              style={{ width: "100%" }}
              data-ai-field="script-editor.notes"
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ fontWeight: 700 }}>Entries</div>
              <button type="button" onClick={addEntry} data-ai-action="script-editor.add-entry">
                新增 entry
              </button>
            </div>
            {entryRows.map((row, index) => {
              const leftClient = row.left_snapshot && row.left_snapshot.includes("/") ? row.left_snapshot.split("/", 2)[0] : defaultClientId || "";
              const rightClient = row.right_snapshot && row.right_snapshot.includes("/") ? row.right_snapshot.split("/", 2)[0] : defaultClientId || "";
              const leftOptions = snapshotOptions[leftClient] || [];
              const rightOptions = snapshotOptions[rightClient] || [];
              return (
                <div
                  key={`entry-${index}`}
                  style={{ border: "1px solid #0f4", padding: 10, marginBottom: 8, background: "#010" }}
                  data-ai-role="script-editor.entry-row"
                >
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                    <span style={{ color: "#82dca5" }}>#{index + 1}</span>
                    <select
                      value={row.type}
                      onChange={(e) => setEntryField(index, "type", e.target.value as "scene" | "snapshot_pair")}
                      data-ai-field={`script-editor.entry-${index}.type`}
                    >
                      <option value="scene">scene</option>
                      <option value="snapshot_pair">snapshot_pair</option>
                    </select>
                    <button type="button" onClick={() => duplicateEntry(index)} data-ai-action="script-editor.duplicate-entry">
                      複製
                    </button>
                    <button type="button" onClick={() => removeEntry(index)} data-ai-action="script-editor.remove-entry" disabled={entryRows.length <= 1}>
                      移除
                    </button>
                    {index > 0 && (
                      <button type="button" onClick={() => moveEntry(index, index - 1)} data-ai-action="script-editor.move-up">
                        上移
                      </button>
                    )}
                    {index < entryRows.length - 1 && (
                      <button type="button" onClick={() => moveEntry(index, index + 1)} data-ai-action="script-editor.move-down">
                        下移
                      </button>
                    )}
                  </div>

                  {row.type === "scene" ? (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
                      <label style={{ display: "flex", flexDirection: "column" }}>
                        scene_id
                        <select
                          value={row.scene_id || ""}
                          onChange={(e) => setEntryField(index, "scene_id", e.target.value)}
                          data-ai-field={`script-editor.entry-${index}.scene-id`}
                        >
                          <option value="">-- 選擇 scene --</option>
                          {scenes.map((scene) => (
                            <option key={scene.id} value={scene.id}>
                              {scene.id} {scene.title ? `(${scene.title})` : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label style={{ display: "flex", flexDirection: "column" }}>
                        duration (s)
                        <input
                          type="number"
                          min="0.1"
                          step="0.1"
                          value={row.duration}
                          onChange={(e) => setEntryField(index, "duration", Number(e.target.value))}
                          data-ai-field={`script-editor.entry-${index}.duration`}
                        />
                      </label>
                      <label style={{ display: "flex", flexDirection: "column" }}>
                        notes
                        <input
                          type="text"
                          value={row.notes || ""}
                          onChange={(e) => setEntryField(index, "notes", e.target.value)}
                          data-ai-field={`script-editor.entry-${index}.notes`}
                        />
                      </label>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
                      <label style={{ display: "flex", flexDirection: "column" }}>
                        left_snapshot (client/name)
                        <input
                          type="text"
                          value={row.left_snapshot || ""}
                          onChange={(e) => setEntryField(index, "left_snapshot", e.target.value)}
                          placeholder="client/name"
                          data-ai-field={`script-editor.entry-${index}.left-snapshot`}
                        />
                        <select
                          value={row.left_snapshot && row.left_snapshot.includes("/") ? row.left_snapshot.split("/", 2)[1] : ""}
                          onChange={(e) =>
                            setEntryField(index, "left_snapshot", leftClient ? `${leftClient}/${e.target.value}` : e.target.value)
                          }
                          data-ai-field={`script-editor.entry-${index}.left-select`}
                        >
                          <option value="">-- 選擇 --</option>
                          {leftOptions.map((opt) => (
                            <option key={`${opt.client}/${opt.name || opt.id}`} value={opt.name || opt.id}>
                              {opt.client}/{opt.name || opt.id}
                            </option>
                          ))}
                        </select>
                        <button type="button" onClick={() => refreshSnapshotsForClient(leftClient)} data-ai-action="script-editor.refresh-left">
                          重新載入 snapshot（left）
                        </button>
                      </label>
                      <label style={{ display: "flex", flexDirection: "column" }}>
                        right_snapshot (client/name)
                        <input
                          type="text"
                          value={row.right_snapshot || ""}
                          onChange={(e) => setEntryField(index, "right_snapshot", e.target.value)}
                          placeholder="client/name"
                          data-ai-field={`script-editor.entry-${index}.right-snapshot`}
                        />
                        <select
                          value={row.right_snapshot && row.right_snapshot.includes("/") ? row.right_snapshot.split("/", 2)[1] : ""}
                          onChange={(e) =>
                            setEntryField(index, "right_snapshot", rightClient ? `${rightClient}/${e.target.value}` : e.target.value)
                          }
                          data-ai-field={`script-editor.entry-${index}.right-select`}
                        >
                          <option value="">-- 選擇 --</option>
                          {rightOptions.map((opt) => (
                            <option key={`${opt.client}/${opt.name || opt.id}`} value={opt.name || opt.id}>
                              {opt.client}/{opt.name || opt.id}
                            </option>
                          ))}
                        </select>
                        <button type="button" onClick={() => refreshSnapshotsForClient(rightClient)} data-ai-action="script-editor.refresh-right">
                          重新載入 snapshot（right）
                        </button>
                      </label>
                      <label style={{ display: "flex", flexDirection: "column" }}>
                        duration (s)
                        <input
                          type="number"
                          min="0.1"
                          step="0.1"
                          value={row.duration}
                          onChange={(e) => setEntryField(index, "duration", Number(e.target.value))}
                          data-ai-field={`script-editor.entry-${index}.duration`}
                        />
                      </label>
                      <label style={{ display: "flex", flexDirection: "column" }}>
                        notes
                        <input
                          type="text"
                          value={row.notes || ""}
                          onChange={(e) => setEntryField(index, "notes", e.target.value)}
                          data-ai-field={`script-editor.entry-${index}.notes`}
                        />
                      </label>
                    </div>
                  )}

                  <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
                    <label style={{ display: "flex", flexDirection: "column" }}>
                      audio left (0~1)
                      <input
                        type="number"
                        min="0"
                        max="1"
                        step="0.05"
                        value={row.audio_override?.left ?? ""}
                        onChange={(e) => setEntryAudioField(index, "left", e.target.value)}
                        data-ai-field={`script-editor.entry-${index}.audio-left`}
                      />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column" }}>
                      audio right (0~1)
                      <input
                        type="number"
                        min="0"
                        max="1"
                        step="0.05"
                        value={row.audio_override?.right ?? ""}
                        onChange={(e) => setEntryAudioField(index, "right", e.target.value)}
                        data-ai-field={`script-editor.entry-${index}.audio-right`}
                      />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column" }}>
                      audio mode
                      <input
                        type="text"
                        value={row.audio_override?.mode ?? ""}
                        onChange={(e) => setEntryAudioField(index, "mode", e.target.value)}
                        data-ai-field={`script-editor.entry-${index}.audio-mode`}
                      />
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input
                        type="checkbox"
                        checked={Boolean(row.audio_override?.muted)}
                        onChange={(e) => setEntryAudioField(index, "muted", e.target.checked)}
                        data-ai-field={`script-editor.entry-${index}.audio-muted`}
                      />
                      muted
                    </label>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }} data-ai-role="script-editor.actions">
            <button type="button" onClick={validateAndPreview} disabled={isPreviewing} data-ai-action="script-editor.validate">
              {isPreviewing ? "驗證中..." : "驗證並預覽"}
            </button>
            <button type="button" onClick={saveScript} disabled={!canWriteMetadata || isSaving} data-ai-action="script-editor.save">
              {isSaving ? "儲存中..." : "儲存"}
            </button>
            <button type="button" onClick={playCurrentScript} disabled={isPlaying} data-ai-action="script-editor.play">
              {isPlaying ? "播放中..." : "播放"}
            </button>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              Queue client
              <input
                type="text"
                value={queueClientId}
                onChange={(e) => setQueueClientId(e.target.value)}
                style={{ width: 120 }}
                data-ai-field="script-editor.queue-client"
              />
            </label>
            <button type="button" onClick={enqueueScript} disabled={isEnqueuing} data-ai-action="script-editor.enqueue">
              {isEnqueuing ? "排程中..." : "加入 queue"}
            </button>
          </div>
        </div>

        <div style={columnStyle} data-ai-section="script-editor.right">
          <label style={labelStyle} htmlFor="script-editor-json">
            JSON 預覽
          </label>
          <textarea
            id="script-editor-json"
            value={jsonText}
            readOnly
            style={{ width: "100%", height: 180, fontFamily: "monospace" }}
            data-ai-field="script-editor.json"
          />

          <div style={{ marginTop: 10 }} data-ai-role="script-editor.validation">
            <div style={{ fontWeight: 700, marginBottom: 6 }}>驗證結果</div>
            {validationErrors.length === 0 ? (
              <div style={{ color: "#3aff85" }} data-ai-status="script-editor.validation-ok">
                未發現錯誤
              </div>
            ) : (
              <ul style={{ paddingLeft: 16, color: "#ff6b6b" }} data-ai-status="script-editor.validation-errors">
                {validationErrors.map((err, idx) => (
                  <li key={`${err.path}-${idx}`}>
                    <strong>{err.path}：</strong>
                    {err.message}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div style={{ ...previewContainerStyle, marginTop: 12 }} data-ai-section="script-editor.preview">
            <div style={previewTitleStyle}>解析預覽（entries）</div>
            {previewEntries.length === 0 && (
              <div style={{ color: "#82dca5" }} data-ai-state="empty">
                尚未產生預覽，請先點「驗證並預覽」
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 10 }}>
              {previewEntries.map((entry, idx) => (
                <div key={`preview-${idx}`} style={{ border: "1px solid #0f4", padding: 8 }}>
                  <div style={{ marginBottom: 4, color: "#82dca5" }}>
                    {entry.label} · {entry.duration ?? 0}s
                  </div>
                  {entry.sceneTargets && entry.sceneTargets.length > 0 && (
                    <div>
                      {entry.sceneTargets.slice(0, 2).map((t, i) => (
                        <div key={`${t.client}-${i}`} style={{ marginBottom: 6 }}>
                          <div style={{ fontSize: 12, color: "#82dca5" }}>
                            {t.client}/{t.snapshot}
                          </div>
                          {t.previewSrc ? (
                            <iframe
                              title={`scene-target-${idx}-${i}`}
                              src={t.previewSrc}
                              style={{ width: "100%", height: 160, border: "1px solid #0f4" }}
                              sandbox="allow-scripts allow-same-origin"
                            />
                          ) : (
                            <div style={{ color: "#ffb347" }}>{t.error || "無法預覽"}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {(entry.left || entry.right) && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
                      {entry.left && (
                        <div>
                          <div style={{ fontSize: 12, color: "#82dca5" }}>{entry.left.snapshot}</div>
                          {entry.left.previewSrc ? (
                            <iframe
                              title={`left-${idx}`}
                              src={entry.left.previewSrc}
                              style={{ width: "100%", height: 140, border: "1px solid #0f4" }}
                              sandbox="allow-scripts allow-same-origin"
                            />
                          ) : (
                            <div style={{ color: "#ffb347" }}>{entry.left.error || "無法預覽"}</div>
                          )}
                        </div>
                      )}
                      {entry.right && (
                        <div>
                          <div style={{ fontSize: 12, color: "#82dca5" }}>{entry.right.snapshot}</div>
                          {entry.right.previewSrc ? (
                            <iframe
                              title={`right-${idx}`}
                              src={entry.right.previewSrc}
                              style={{ width: "100%", height: 140, border: "1px solid #0f4" }}
                              sandbox="allow-scripts allow-same-origin"
                            />
                          ) : (
                            <div style={{ color: "#ffb347" }}>{entry.right.error || "無法預覽"}</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {message && (
        <div style={{ marginTop: 8, color: "#82dca5", letterSpacing: "0.03em" }} role="status" data-ai-status="script-editor.message">
          {message}
        </div>
      )}
    </div>
  );
}
