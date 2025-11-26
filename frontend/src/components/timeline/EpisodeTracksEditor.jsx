import React from "react";
import { labelStyle } from "../../AdminPanelStyles";

export default function EpisodeTracksEditor({
  tracks,
  selectedRows,
  onToggleRow,
  onMoveRow,
  onDuplicateRow,
  onRemoveRow,
  onAddTrack,
  onCopy,
  onPaste,
  canPaste,
  batchTargetClient,
  onBatchTargetChange,
  onBatchApply,
  onTrackChange,
  episodeTargetOverride,
  onTargetOverrideChange,
}) {
  return (
    <div data-ai-section="episode.tracks">
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
        <button type="button" onClick={onAddTrack} data-ai-action="episode.track.add">
          新增 track
        </button>
        <button type="button" onClick={onCopy} disabled={!selectedRows.length} data-ai-action="episode.track.copy">
          複製選取
        </button>
        <button type="button" onClick={onPaste} disabled={!canPaste} data-ai-action="episode.track.paste">
          貼上
        </button>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          批次 target
          <input
            type="text"
            value={batchTargetClient}
            onChange={(e) => onBatchTargetChange(e.target.value)}
            style={{ width: 160 }}
            data-ai-field="episode.batch.target-client"
          />
          <button
            type="button"
            onClick={onBatchApply}
            disabled={!batchTargetClient || !selectedRows.length}
            data-ai-action="episode.track.batch-target"
          >
            套用
          </button>
        </label>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {(tracks || []).map((track, index) => (
          <div
            key={index}
            style={{
              border: "1px solid #0f4",
              borderRadius: 0,
              padding: 10,
              background: selectedRows.includes(index) ? "#020" : "#000",
              boxShadow: "none",
            }}
            data-ai-item={`episode.track:${index}`}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="checkbox"
                  checked={selectedRows.includes(index)}
                  onChange={() => onToggleRow(index)}
                  aria-label={`選取 track ${index + 1}`}
                  data-ai-field={`episode.track[${index}].selected`}
                />
                Track {index + 1}
              </label>
              <button type="button" onClick={() => onMoveRow(index, -1)} aria-label="上移" data-ai-action="episode.track.move-up">
                ↑
              </button>
              <button type="button" onClick={() => onMoveRow(index, 1)} aria-label="下移" data-ai-action="episode.track.move-down">
                ↓
              </button>
              <button type="button" onClick={() => onDuplicateRow(index)} aria-label="複製 track" data-ai-action="episode.track.duplicate">
                複製
              </button>
              <button
                type="button"
                onClick={() => onRemoveRow(index)}
                aria-label="刪除 track"
                data-ai-action="episode.track.delete"
                data-ai-danger="true"
              >
                刪除
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <label style={{ display: "flex", flexDirection: "column" }}>
                timelineId
                <input
                  type="text"
                  value={track.timelineId || track.timeline_id || ""}
                  onChange={(e) => onTrackChange(index, { timelineId: e.target.value })}
                  data-ai-field={`episode.track[${index}].timeline-id`}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column" }}>
                targetClientId
                <input
                  type="text"
                  value={track.targetClientId || track.target_client_id || ""}
                  onChange={(e) => onTrackChange(index, { targetClientId: e.target.value })}
                  data-ai-field={`episode.track[${index}].target-client`}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column" }}>
                offset/delay
                <input
                  type="number"
                  value={track.offset ?? track.delay ?? 0}
                  onChange={(e) => onTrackChange(index, { offset: Number(e.target.value) })}
                  data-ai-field={`episode.track[${index}].offset`}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column" }}>
                label
                <input
                  type="text"
                  value={track.label || ""}
                  onChange={(e) => onTrackChange(index, { label: e.target.value })}
                  data-ai-field={`episode.track[${index}].label`}
                />
              </label>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10 }}>
        <label style={labelStyle} htmlFor="episode-target-override">
          目標 map 覆寫（timeline:client，以逗號分隔）
        </label>
        <input
          id="episode-target-override"
          type="text"
          value={episodeTargetOverride}
          onChange={(e) => onTargetOverrideChange(e.target.value)}
          style={{ width: "100%" }}
          data-ai-field="episode.target-override"
        />
      </div>
    </div>
  );
}
