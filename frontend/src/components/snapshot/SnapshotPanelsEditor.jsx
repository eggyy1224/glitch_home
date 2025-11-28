import React from "react";

export default function SnapshotPanelsEditor({
  panels,
  selectedRows,
  onToggleRow,
  onMoveRow,
  onDuplicateRow,
  onRemoveRow,
  onAddPanel,
  onCopy,
  onPaste,
  canPaste,
  onPanelChange,
}) {
  return (
    <div data-ai-section="snapshot.panels">
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
        <button type="button" onClick={onAddPanel} data-ai-action="snapshot.panel.add">
          新增 panel
        </button>
        <button type="button" onClick={onCopy} disabled={!selectedRows.length} data-ai-action="snapshot.panel.copy">
          複製選取
        </button>
        <button type="button" onClick={onPaste} disabled={!canPaste} data-ai-action="snapshot.panel.paste">
          貼上
        </button>
        <span style={{ color: "#82dca5" }}>至少填 url 或 image</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {(panels || []).map((panel, index) => (
          <div
            key={panel?.id || index}
            style={{
              border: "1px solid #0f4",
              borderRadius: 0,
              padding: 10,
              background: selectedRows.includes(index) ? "#020" : "#000",
              boxShadow: "none",
            }}
            data-ai-item={`snapshot.panel:${index}`}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="checkbox"
                  checked={selectedRows.includes(index)}
                  onChange={() => onToggleRow(index)}
                  aria-label={`選取 panel ${index + 1}`}
                  data-ai-field={`snapshot.panel[${index}].selected`}
                />
                Panel {index + 1}
              </label>
              <button type="button" onClick={() => onMoveRow(index, -1)} aria-label="上移" data-ai-action="snapshot.panel.move-up">
                ↑
              </button>
              <button type="button" onClick={() => onMoveRow(index, 1)} aria-label="下移" data-ai-action="snapshot.panel.move-down">
                ↓
              </button>
              <button
                type="button"
                onClick={() => onDuplicateRow(index)}
                aria-label="複製 panel"
                data-ai-action="snapshot.panel.duplicate"
              >
                複製
              </button>
              <button
                type="button"
                onClick={() => onRemoveRow(index)}
                aria-label="刪除 panel"
                data-ai-action="snapshot.panel.delete"
                data-ai-danger="true"
              >
                刪除
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
              <label style={{ display: "flex", flexDirection: "column" }}>
                id
                <input
                  type="text"
                  value={panel?.id || ""}
                  onChange={(e) => onPanelChange(index, { id: e.target.value })}
                  data-ai-field={`snapshot.panel[${index}].id`}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column" }}>
                url
                <input
                  type="text"
                  value={panel?.url || ""}
                  onChange={(e) => onPanelChange(index, { url: e.target.value })}
                  placeholder="例如 /?slide_mode=true"
                  data-ai-field={`snapshot.panel[${index}].url`}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column" }}>
                image
                <input
                  type="text"
                  value={panel?.image || ""}
                  onChange={(e) => onPanelChange(index, { image: e.target.value })}
                  placeholder="offspring_xxx.png"
                  data-ai-field={`snapshot.panel[${index}].image`}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column" }}>
                label
                <input
                  type="text"
                  value={panel?.label || ""}
                  onChange={(e) => onPanelChange(index, { label: e.target.value })}
                  data-ai-field={`snapshot.panel[${index}].label`}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column" }}>
                ratio
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={panel?.ratio ?? ""}
                  onChange={(e) => onPanelChange(index, { ratio: Number(e.target.value) })}
                  data-ai-field={`snapshot.panel[${index}].ratio`}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column" }}>
                colSpan
                <input
                  type="number"
                  min="1"
                  value={panel?.colSpan ?? panel?.col_span ?? ""}
                  onChange={(e) => onPanelChange(index, { colSpan: Number(e.target.value) })}
                  data-ai-field={`snapshot.panel[${index}].colSpan`}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column" }}>
                rowSpan
                <input
                  type="number"
                  min="1"
                  value={panel?.rowSpan ?? panel?.row_span ?? ""}
                  onChange={(e) => onPanelChange(index, { rowSpan: Number(e.target.value) })}
                  data-ai-field={`snapshot.panel[${index}].rowSpan`}
                />
              </label>
            </div>
          </div>
        ))}
        {(!panels || panels.length === 0) && (
          <div style={{ color: "#82dca5" }} data-ai-state="empty">
            尚未新增 panel
          </div>
        )}
      </div>
    </div>
  );
}
