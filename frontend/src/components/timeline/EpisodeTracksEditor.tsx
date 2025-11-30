import React, { useMemo } from "react";
import { labelStyle } from "../../AdminPanelStyles";
import type { EpisodeTrack, IframeTimeline } from "../../types/timeline";

interface EpisodeTracksEditorProps {
  tracks: EpisodeTrack[];
  selectedRows: number[];
  onToggleRow: (index: number) => void;
  onMoveRow: (index: number, delta: number) => void;
  onDuplicateRow: (index: number) => void;
  onRemoveRow: (index: number) => void;
  onAddTrack: () => void;
  onCopy: () => void;
  onPaste: () => void;
  canPaste: boolean;
  batchTargetClient: string;
  onBatchTargetChange: (value: string) => void;
  onBatchApply: () => void;
  onTrackChange: (index: number, patch: Partial<EpisodeTrack>) => void;
  episodeTargetOverride: string;
  onTargetOverrideChange: (value: string) => void;
  timelineOptions?: IframeTimeline[];
}

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
  timelineOptions = [],
}: EpisodeTracksEditorProps) {
  const lanes = useMemo(() => {
    const groups = new Map<string, Array<EpisodeTrack & { index: number }>>();
    (tracks || []).forEach((track, index) => {
      const target = track.targetClientId || track.target_client_id || "(未指定)";
      if (!groups.has(target)) groups.set(target, []);
      groups.get(target)?.push({ ...track, index });
    });
    return Array.from(groups.entries());
  }, [tracks]);

  return (
    <div data-ai-section="episode.tracks">
      <div style={{ border: "1px solid #0f4", padding: 10, marginBottom: 12, background: "#010", borderRadius: 4 }}>
        <div style={{ color: "#82dca5", marginBottom: 6 }}>Client 泳道（可視化 offset/長度）</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {lanes.map(([client, clientTracks]) => (
            <div key={client} style={{ border: "1px dashed #0f4", padding: 6, borderRadius: 4 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{client}</div>
              <div style={{ display: "flex", gap: 6, position: "relative", minHeight: 46 }}>
                {clientTracks.map((track) => {
                  const offset = Number(track.offset ?? track.delay ?? 0);
                  const width = 140 + Math.max(0, offset) * 4;
                  const timelineLabel = track.timelineId || track.timeline_id || "未選擇 timeline";
                  const isActive = selectedRows.includes(track.index);
                  return (
                    <button
                      key={`lane-${client}-${track.index}`}
                      type="button"
                      onClick={() => onToggleRow(track.index)}
                      style={{
                        marginLeft: `${Math.max(0, offset) * 2}px`,
                        minWidth: width,
                        border: `2px solid ${isActive ? "#82dca5" : "#0f4"}`,
                        background: isActive ? "#0a280a" : "#021",
                        color: "#c8ffd2",
                        borderRadius: 6,
                        padding: 6,
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 12 }}>{timelineLabel}</div>
                      <div style={{ fontSize: 11, color: "#82dca5" }}>offset：{offset}s</div>
                    </button>
                  );
                })}
                {clientTracks.length === 0 && <div style={{ color: "#82dca5" }}>尚無 track</div>}
              </div>
            </div>
          ))}
          {lanes.length === 0 && <div style={{ color: "#82dca5" }}>尚未新增任何 track</div>}
        </div>
      </div>
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
            {(() => {
              const targetClient = track.targetClientId || track.target_client_id || "";
              const filteredTimelines = (timelineOptions || []).filter((item) => {
                if (!item || !item.id) return false;
                const client = item.clientId || item.client_id || item.client || "";
                return !targetClient || client === targetClient;
              });
              const datalistId = `timeline-options-${index}`;

              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 6 }}>
                  <div style={{ fontSize: 12, color: "#82dca5" }}>
                    timeline 選單：{targetClient ? `client ${targetClient}` : "全部 client"}
                    {filteredTimelines.length === 0 ? "（無可用 timeline）" : `（${filteredTimelines.length} 筆）`}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <label style={{ display: "flex", flexDirection: "column" }}>
                      timelineId
                      <input
                        type="text"
                        list={datalistId}
                        value={track.timelineId || track.timeline_id || ""}
                        onChange={(e) => onTrackChange(index, { timelineId: e.target.value })}
                        data-ai-field={`episode.track[${index}].timeline-id`}
                      />
                      <datalist id={datalistId}>
                        {(filteredTimelines || []).map((item) => (
                          <option
                            key={`${item.client_id || item.clientId || item.client || "client"}:${item.id}`}
                            value={item.id}
                          >{`${item.id} · ${item.client_id || item.clientId || item.client || "n/a"}`}</option>
                        ))}
                      </datalist>
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
                  </div>
                </div>
              );
            })()}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
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
