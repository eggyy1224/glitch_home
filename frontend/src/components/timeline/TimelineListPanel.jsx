import React from "react";
import { labelStyle } from "../../AdminPanelStyles";

export default function TimelineListPanel({
  filter,
  onFilterChange,
  onReload,
  timelines,
  onSelect,
}) {
  return (
    <div>
      <div style={{ marginBottom: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <label style={labelStyle} htmlFor="timeline-search">
          Timeline 列表
        </label>
        <input
          id="timeline-search"
          type="text"
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          placeholder="client 篩選"
          style={{ width: 140 }}
          data-ai-field="timeline.filter-client"
        />
        <button type="button" onClick={onReload} data-ai-action="timeline.reload-list">
          重新載入
        </button>
      </div>
      <ul
        role="list"
        data-ai-id="timeline.list"
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
        {timelines.length === 0 && (
          <li style={{ color: "#82dca5" }} data-ai-state="empty">
            尚無資料
          </li>
        )}
        {timelines.map((item) => (
          <li
            key={item.id}
            role="listitem"
            data-ai-item={`timeline:${item.id}`}
            style={{ display: "flex", alignItems: "center", marginBottom: 6 }}
          >
            <div style={{ flex: 1 }}>
              {item.id} ({item.client_id || "n/a"})
            </div>
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              data-ai-action="timeline.load"
              aria-label={`載入 timeline ${item.id}`}
            >
              載入
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
