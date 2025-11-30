import React from "react";
import { labelStyle } from "../../AdminPanelStyles";
import type { EpisodeEntry } from "../../types/timeline";

interface EpisodeListPanelProps {
  filter: string;
  onFilterChange: (value: string) => void;
  onReload: () => void;
  episodes: EpisodeEntry[];
  onSelect: (id: string) => void;
}

export default function EpisodeListPanel({ filter, onFilterChange, onReload, episodes, onSelect }: EpisodeListPanelProps) {
  return (
    <div>
      <div style={{ marginBottom: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <label style={labelStyle} htmlFor="episode-search">
          Episode 列表
        </label>
        <input
          id="episode-search"
          type="text"
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          placeholder="id 篩選"
          style={{ width: 140 }}
          data-ai-field="episode.filter-id"
        />
        <button type="button" onClick={onReload} data-ai-action="episode.reload-list">
          重新載入
        </button>
      </div>
      <ul
        role="list"
        data-ai-id="episode.list"
        style={{
          border: "1px solid #0f4",
          borderRadius: 0,
          maxHeight: 200,
          overflowY: "auto",
          padding: 8,
          listStyle: "none",
          margin: 0,
          background: "#000",
        }}
      >
        {episodes.length === 0 && (
          <li style={{ color: "#82dca5" }} data-ai-state="empty">
            尚無資料
          </li>
        )}
        {episodes.map((item) => (
          <li
            key={item.id}
            role="listitem"
            data-ai-item={`episode:${item.id}`}
            style={{ display: "flex", alignItems: "center", marginBottom: 6 }}
          >
            <div style={{ flex: 1 }}>{item.id}</div>
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              data-ai-action="episode.load"
              aria-label={`載入 episode ${item.id}`}
            >
              載入
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
