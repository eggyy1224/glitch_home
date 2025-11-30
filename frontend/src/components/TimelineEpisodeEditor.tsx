import React from "react";
import {
  activeTabButtonStyle,
  boxStyle,
  columnsStyle,
  columnStyle,
  labelStyle,
  previewContainerStyle,
  previewTitleStyle,
  resizerHandleStyle,
  resizerHitboxStyle,
  snapshotPreviewIframeStyle,
  tabButtonStyle,
} from "../AdminPanelStyles";
import useTimelineEpisodeEditor from "../hooks/useTimelineEpisodeEditor";
import { formatTs, snapshotValueForSelect, toggleIndex } from "../utils/adminEditorUtils";
import EpisodeListPanel from "./timeline/EpisodeListPanel";
import EpisodeTracksEditor from "./timeline/EpisodeTracksEditor";
import SnapshotPanelsEditor from "./snapshot/SnapshotPanelsEditor";
import TimelineListPanel from "./timeline/TimelineListPanel";
import TimelinePreviewPlayer from "./timeline/TimelinePreviewPlayer";
import TimelineStepsEditor from "./timeline/TimelineStepsEditor";

export default function TimelineEpisodeEditor() {
  const {
    mode,
    dirty,
    message,
    lastSyncAt,
    jsonLocked,
    jsonReadOnly,
    setJsonLocked,
    setJsonReadOnly,
    dataState,
    validationErrors,
    validationState,
    activeData,
    timelineData,
    episodeData,
    snapshotData,
    setEpisodeState,
    updateTimeline,
    updateSnapshot,
    timelineList,
    episodeList,
    timelineFilter,
    episodeFilter,
    setTimelineFilter,
    setEpisodeFilter,
    refreshTimelines,
    refreshEpisodes,
    refreshSnapshots,
    snapshotClient,
    setSnapshotClient,
    snapshotKeyword,
    setSnapshotKeyword,
    snapshotName,
    setSnapshotName,
    snapshotOptions,
    snapshotMessage,
    selectedRows,
    setSelectedRows,
    batchDuration,
    setBatchDuration,
    batchTargetClient,
    setBatchTargetClient,
    timelinePreviewSrc,
    timelinePreviewError,
    timelinePlaySrc,
    timelinePlayError,
    snapshotPreviewSrc,
    snapshotPreviewError,
    snapshotPreviewWidth,
    snapshotFrameHeight,
    episodeTargetOverride,
    setEpisodeTargetOverride,
    isSaving,
    jsonText,
    handleModeChange,
    handleLoadSelected,
    handleLoadSnapshot,
    handleSave,
    handleJsonChange,
    handleStepChange,
    handleTrackChange,
    handlePanelChange,
    handleCopy,
    handlePaste,
    handleBatchApply,
    handlePlayPreview,
    handlePlayTimelineToClient,
    handlePlayEpisode,
    handlePlaySnapshot,
    addStep,
    addTrack,
    addPanel,
    moveRow,
    duplicateRow,
    removeRow,
    focusRow,
    syncJsonFromData,
    canTimelinePaste,
    canEpisodePaste,
    canSnapshotPaste,
    startSnapshotResize,
  } = useTimelineEpisodeEditor();

  return (
    <div
      style={boxStyle}
      data-ai-id="admin.timeline-episode-editor"
      data-ai-section="admin.timeline-episode-editor"
      data-ai-role="editor.panel"
      data-ai-state={dataState}
    >
      <section
        aria-label="Editor 操作順序"
        data-ai-role="editor.instructions"
        style={{ marginBottom: 10, padding: "8px 10px", border: "1px solid #0f4", background: "#020" }}
      >
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Editor 流程（AI/自動化參考）</div>
        <ol style={{ margin: 0, paddingLeft: 18, color: "#82dca5", lineHeight: 1.5 }}>
          <li data-ai-role="editor.step-note.mode">步驟 1：選擇模式（Snapshot / Timeline / Episode）並載入目標記錄。</li>
          <li data-ai-role="editor.step-note.edit">步驟 2：在左側列表挑選條目，編輯表單欄位或 steps/tracks。</li>
          <li data-ai-role="editor.step-note.sync">步驟 3：如需同步 JSON，確認鎖定與否，必要時使用「以表單覆寫 JSON」。</li>
          <li data-ai-role="editor.step-note.save">步驟 4：按「儲存」，再視需求播放到 client / 以 iframe 預覽。</li>
        </ol>
      </section>
      <div
        style={{ marginBottom: 8, display: "flex", gap: 8, flexWrap: "wrap" }}
        role="tablist"
        aria-label="Snapshot / Timeline / Episode 模式選擇"
        data-ai-id="timeline-episode.mode-switch"
      >
        <button
          type="button"
          onClick={() => handleModeChange("snapshot")}
          style={mode === "snapshot" ? activeTabButtonStyle : tabButtonStyle}
          role="tab"
          aria-selected={mode === "snapshot"}
          aria-controls="admin-editor-panel"
          id="snapshot-editor-tab"
          data-ai-action="timeline-episode.switch-snapshot"
          data-ai-role="editor-tab"
          data-ai-tab-id="snapshot"
        >
          Snapshot 模式
        </button>
        <button
          type="button"
          onClick={() => handleModeChange("timeline")}
          style={mode === "timeline" ? activeTabButtonStyle : tabButtonStyle}
          role="tab"
          aria-selected={mode === "timeline"}
          aria-controls="admin-editor-panel"
          id="timeline-editor-tab"
          data-ai-action="timeline-episode.switch-timeline"
          data-ai-role="editor-tab"
          data-ai-tab-id="timeline"
        >
          Timeline 模式
        </button>
        <button
          type="button"
          onClick={() => handleModeChange("episode")}
          style={mode === "episode" ? activeTabButtonStyle : tabButtonStyle}
          role="tab"
          aria-selected={mode === "episode"}
          aria-controls="admin-editor-panel"
          id="episode-editor-tab"
          data-ai-action="timeline-episode.switch-episode"
          data-ai-role="editor-tab"
          data-ai-tab-id="episode"
        >
          Episode 模式
        </button>
        <span style={{ color: dirty ? "#ff6b6b" : "#82dca5", letterSpacing: "0.03em" }} data-ai-status="timeline-episode.dirty">
          {dirty ? "未保存變更" : "已同步"}
        </span>
        <span style={{ color: "#82dca5" }} data-ai-status="timeline-episode.last-sync">
          最後同步：{formatTs(lastSyncAt) || "--"}
        </span>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            checked={jsonLocked}
            onChange={(e) => setJsonLocked(e.target.checked)}
            aria-label="鎖定 JSON"
            data-ai-field="timeline-episode.json-lock"
          />
          鎖定 JSON 同步
        </label>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          marginBottom: 12,
          border: "1px solid #0f4",
          padding: 10,
          background: "#010",
          borderRadius: 4,
        }}
        data-ai-role="editor.status"
        data-ai-state={dataState}
      >
        <div style={{ color: "#c8ffd2", fontWeight: 700 }}>狀態條</div>
        <span style={{ color: dirty ? "#ff6b6b" : "#82dca5" }} data-ai-status="editor.saving">
          儲存狀態：{dirty ? "未儲存" : "已儲存"}
        </span>
        <span style={{ color: validationErrors.length ? "#ffb347" : "#82dca5" }} data-ai-status="editor.validation-count">
          錯誤數：{validationErrors.length}
        </span>
        <span style={{ color: "#82dca5" }} data-ai-status="editor.shortcuts">
          快捷鍵：Cmd+S 儲存、空白鍵播放預覽、方向鍵移動選取
        </span>
        {message && (
          <span
            style={{
              background: "#1f1f1f",
              border: "1px solid #ffb347",
              padding: "4px 8px",
              borderRadius: 4,
              color: "#ffb347",
            }}
            data-ai-role="editor.message"
          >
            {message}
          </span>
        )}
      </div>

      <div style={columnsStyle}>
        <div
          style={columnStyle}
          role="tabpanel"
          aria-labelledby={
            mode === "timeline" ? "timeline-editor-tab" : mode === "episode" ? "episode-editor-tab" : "snapshot-editor-tab"
          }
          id="admin-editor-panel"
          data-ai-section={
            mode === "timeline" ? "timeline.editor" : mode === "episode" ? "episode.editor" : "snapshot.editor"
          }
          data-ai-role="editor.tab-panel"
          data-ai-tab-id={mode}
          data-ai-state={dataState}
        >
          {mode === "snapshot" ? (
            <div data-ai-section="snapshot.editor.left">
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                <label style={labelStyle} htmlFor="snapshot-client">
                  Client
                </label>
                <input
                  id="snapshot-client"
                  type="text"
                  value={snapshotClient || ""}
                  onChange={(e) => setSnapshotClient(e.target.value)}
                  style={{ width: 140 }}
                  data-ai-field="snapshot.editor.client"
                />
                <label style={labelStyle} htmlFor="snapshot-name">
                  名稱
                </label>
                <input
                  id="snapshot-name"
                  type="text"
                  value={snapshotName}
                  onChange={(e) => setSnapshotName(e.target.value)}
                  style={{ width: 160 }}
                  data-ai-field="snapshot.editor.name"
                />
                <input
                  type="text"
                  placeholder="關鍵字"
                  value={snapshotKeyword}
                  onChange={(e) => setSnapshotKeyword(e.target.value)}
                  style={{ width: 140 }}
                  data-ai-field="snapshot.editor.keyword"
                />
                <button type="button" onClick={() => refreshSnapshots(snapshotClient)} data-ai-action="snapshot.editor.reload">
                  重新載入
                </button>
                <button type="button" onClick={() => handleLoadSnapshot(snapshotName)} data-ai-action="snapshot.editor.load">
                  載入
                </button>
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ marginBottom: 4 }}>Snapshot 列表（{snapshotMessage || "尚未載入"}）</div>
                <ul
                  role="list"
                  data-ai-id="snapshot.editor.list"
                  style={{
                    maxHeight: 180,
                    overflowY: "auto",
                    border: "1px solid #0f4",
                    padding: 8,
                    listStyle: "none",
                    margin: 0,
                    background: "#000",
                  }}
                >
                  {snapshotOptions.length === 0 && (
                    <li style={{ color: "#82dca5" }} data-ai-state="empty">
                      尚無資料
                    </li>
                  )}
                  {snapshotOptions.map((item) => (
                    <li
                      key={`${item.client}/${item.name || item.id}`}
                      style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}
                      data-ai-item={`snapshot:${item.name || item.id}`}
                    >
                      <span style={{ flex: 1 }}>
                        {item.client}/{item.name || item.id} {item.created_at ? `（${formatTs(item.created_at)}）` : ""}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSnapshotName(item.name || item.id);
                          setSnapshotClient(item.client);
                          handleLoadSnapshot(item.name || item.id, item.client);
                        }}
                        data-ai-action="snapshot.editor.load-item"
                      >
                        載入
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, marginBottom: 10 }}>
                <label style={{ display: "flex", flexDirection: "column" }}>
                  layout
                  <select
                    value={snapshotData.layout || "grid"}
                    onChange={(e) => updateSnapshot({ ...snapshotData, layout: e.target.value })}
                    data-ai-field="snapshot.editor.layout"
                  >
                    <option value="grid">grid</option>
                    <option value="horizontal">horizontal</option>
                    <option value="vertical">vertical</option>
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column" }}>
                  gap
                  <input
                    type="number"
                    min="0"
                    value={snapshotData.gap ?? 0}
                    onChange={(e) => updateSnapshot({ ...snapshotData, gap: Number(e.target.value) })}
                    data-ai-field="snapshot.editor.gap"
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column" }}>
                  columns
                  <input
                    type="number"
                    min="1"
                    value={snapshotData.columns ?? 1}
                    onChange={(e) => updateSnapshot({ ...snapshotData, columns: Number(e.target.value) })}
                    data-ai-field="snapshot.editor.columns"
                  />
                </label>
              </div>

              <SnapshotPanelsEditor
                panels={snapshotData.panels}
                selectedRows={selectedRows}
                onToggleRow={(index) => setSelectedRows((prev) => toggleIndex(prev, index))}
                onMoveRow={moveRow}
                onDuplicateRow={duplicateRow}
                onRemoveRow={removeRow}
                onAddPanel={addPanel}
                onCopy={handleCopy}
                onPaste={handlePaste}
                canPaste={canSnapshotPaste}
                onPanelChange={handlePanelChange}
                layoutColumns={snapshotData.columns}
                layoutGap={snapshotData.gap}
                onSelectPanel={focusRow}
              />
            </div>
          ) : (
            <>
              {mode === "timeline" ? (
                <TimelineListPanel
                  filter={timelineFilter}
                  onFilterChange={setTimelineFilter}
                  onReload={refreshTimelines}
                  timelines={timelineList}
                  onSelect={handleLoadSelected}
                />
              ) : (
                <EpisodeListPanel
                  filter={episodeFilter}
                  onFilterChange={setEpisodeFilter}
                  onReload={refreshEpisodes}
                  episodes={episodeList}
                  onSelect={handleLoadSelected}
                />
              )}

              {mode === "timeline" ? (
                <TimelineStepsEditor
                  steps={timelineData.steps}
                  selectedRows={selectedRows}
                  onToggleRow={(index) => setSelectedRows((prev) => toggleIndex(prev, index))}
                  onMoveRow={moveRow}
                  onDuplicateRow={duplicateRow}
                  onRemoveRow={removeRow}
                  onAddStep={addStep}
                  onCopy={handleCopy}
                  onPaste={handlePaste}
                  canPaste={canTimelinePaste}
                  batchDuration={batchDuration}
                  onBatchDurationChange={setBatchDuration}
                  onBatchApply={handleBatchApply}
                  snapshotClient={snapshotClient}
                  snapshotKeyword={snapshotKeyword}
                  onSnapshotClientChange={setSnapshotClient}
                  onSnapshotKeywordChange={setSnapshotKeyword}
                  onRefreshSnapshots={refreshSnapshots}
                  snapshotMessage={snapshotMessage}
                  snapshotOptions={snapshotOptions}
                  onStepChange={handleStepChange}
                  getSnapshotValue={(step) => snapshotValueForSelect(step, timelineData, snapshotClient)}
                />
              ) : (
                <EpisodeTracksEditor
                  tracks={episodeData.tracks}
                  selectedRows={selectedRows}
                  onToggleRow={(index) => setSelectedRows((prev) => toggleIndex(prev, index))}
                  onMoveRow={moveRow}
                  onDuplicateRow={duplicateRow}
                  onRemoveRow={removeRow}
                  onAddTrack={addTrack}
                  onCopy={handleCopy}
                  onPaste={handlePaste}
                  canPaste={canEpisodePaste}
                  batchTargetClient={batchTargetClient}
                  onBatchTargetChange={setBatchTargetClient}
                  onBatchApply={handleBatchApply}
                  onTrackChange={handleTrackChange}
                  episodeTargetOverride={episodeTargetOverride}
                  onTargetOverrideChange={setEpisodeTargetOverride}
                  timelineOptions={timelineList}
                />
              )}
            </>
          )}


          <section style={{ marginTop: 10 }} data-ai-role="editor.primary-fields" aria-label="Editor 基本欄位">
            {mode !== "snapshot" && (
              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle} htmlFor="active-id">
                  {mode === "timeline" ? "Timeline ID" : "Episode ID"}
                </label>
                <input
                  id="active-id"
                  type="text"
                  value={activeData.id || ""}
                  onChange={(e) =>
                    mode === "timeline"
                      ? updateTimeline({ ...timelineData, id: e.target.value })
                      : setEpisodeState({ ...episodeData, id: e.target.value })
                  }
                  style={{ width: "100%", marginBottom: 8 }}
                  data-ai-field={mode === "timeline" ? "timeline.id" : "episode.id"}
                />
              </div>
            )}

            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }} data-ai-role="editor.actions">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                data-ai-action="timeline-episode.save"
                data-ai-role="save-button"
                data-ai-state={isSaving ? "saving" : dirty ? "dirty" : "idle"}
              >
                {isSaving ? "儲存中" : "儲存"}
              </button>
              {mode === "timeline" && (
                <button type="button" onClick={handlePlayTimelineToClient} data-ai-action="timeline.play-client" data-ai-role="play-button">
                  直接播放到 client
                </button>
              )}
              {mode === "timeline" && (
                <button type="button" onClick={handlePlayPreview} data-ai-action="timeline.preview-play" data-ai-role="preview-button">
                  以 iframe 預覽 timeline
                </button>
              )}
              {mode === "episode" && (
                <button type="button" onClick={handlePlayEpisode} data-ai-action="episode.play" data-ai-role="play-button">
                  播放 Episode（含覆寫）
                </button>
              )}
              {mode === "snapshot" && (
                <button type="button" onClick={handlePlaySnapshot} data-ai-action="snapshot.play" data-ai-role="play-button">
                  播放 snapshot
                </button>
              )}
            </div>
          </section>
        </div>

        <div style={columnStyle} data-ai-section="timeline-episode.json-preview" data-ai-role="editor.json">
          <label style={labelStyle} htmlFor="json-area">
            JSON（雙向同步）
          </label>
          <textarea
            id="json-area"
            style={{ width: "100%", height: 240, fontFamily: "monospace" }}
            value={jsonText}
            onChange={(e) => handleJsonChange(e.target.value)}
            readOnly={jsonReadOnly}
            data-ai-field="timeline-episode.json"
          />
          <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => syncJsonFromData(activeData)}
              disabled={jsonLocked}
              data-ai-action="timeline-episode.sync-from-form"
            >
              以表單覆寫 JSON
            </button>
            <button type="button" onClick={() => setJsonLocked((prev) => !prev)} data-ai-action="timeline-episode.toggle-json-lock">
              {jsonLocked ? "解除鎖定" : "鎖定 JSON"}
            </button>
            <button type="button" onClick={() => setJsonReadOnly((prev) => !prev)} data-ai-action="timeline-episode.toggle-json-readonly">
              {jsonReadOnly ? "關閉只讀" : "JSON 只讀預覽"}
            </button>
          </div>

          <div style={{ marginTop: 10 }} data-ai-role="editor.validation" data-ai-state={validationState}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>驗證結果</div>
            {validationErrors.length === 0 ? (
              <div style={{ color: "#3aff85" }} data-ai-status="timeline-episode.validation-ok">
                未發現錯誤
              </div>
            ) : (
              <ul style={{ paddingLeft: 16, color: "#ff6b6b" }} data-ai-status="timeline-episode.validation-errors">
                {validationErrors.map((err, idx) => (
                  <li key={`${err.path}-${idx}`}>
                    <strong>{err.path}：</strong>
                    {err.message}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {mode === "snapshot" && (
            <div
              style={{ ...previewContainerStyle, width: snapshotPreviewWidth, maxWidth: "100%", marginTop: 12 }}
              data-ai-section="snapshot.editor.preview"
              aria-label="Snapshot 預覽區塊"
            >
              <div style={previewTitleStyle}>預覽</div>
              {snapshotPreviewSrc ? (
                <iframe
                  title="snapshot-preview"
                  src={snapshotPreviewSrc}
                  style={{ ...snapshotPreviewIframeStyle, height: snapshotFrameHeight }}
                  sandbox="allow-scripts allow-same-origin"
                  data-ai-id="snapshot.editor.preview.iframe"
                />
              ) : (
                <div style={{ color: "#82dca5" }} data-ai-state="empty">
                  {snapshotPreviewError || "無法產生預覽，請確認至少有一個 panel.url 或 image"}
                </div>
              )}
              <div style={resizerHitboxStyle} onMouseDown={startSnapshotResize} aria-hidden="true">
                <div style={resizerHandleStyle} />
              </div>
            </div>
          )}

          {mode === "timeline" && (
            <TimelinePreviewPlayer
              previewSrc={timelinePreviewSrc}
              previewError={timelinePreviewError}
              playSrc={timelinePlaySrc}
              playError={timelinePlayError}
            />
          )}
        </div>
      </div>

      {message && (
        <div
          style={{ marginTop: 8, color: "#82dca5", letterSpacing: "0.03em" }}
          role="status"
          aria-live="polite"
          data-ai-status="timeline-episode.message"
        >
          {message}
        </div>
      )}
    </div>
  );
}
