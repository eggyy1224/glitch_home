import React from "react";
import type { PanelConfig } from "./types";
import type { PanelMode } from "./panelPresets";
import { getPanelModeAndAsset, MODE_PRESETS } from "./panelPresets";

interface PanelCanvasProps {
  panels: PanelConfig[];
  selectedRows: number[];
  layoutColumns: number;
  layoutGap: number;
  handlePanelDrag: (event: React.DragEvent<HTMLDivElement>, index: number) => void;
  handlePanelDrop: (event: React.DragEvent<HTMLDivElement>, targetIndex: number) => void;
  onPanelChange: (index: number, patch: Partial<PanelConfig>) => void;
  onSelectPanel?: (index: number) => void;
  onToggleRow: (index: number) => void;
}

export function PanelCanvas({
  panels,
  selectedRows,
  layoutColumns,
  layoutGap,
  handlePanelDrag,
  handlePanelDrop,
  onPanelChange,
  onSelectPanel,
  onToggleRow,
}: PanelCanvasProps) {
  const cols = Math.max(1, Number(layoutColumns) || 1);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ color: "#82dca5", letterSpacing: "0.04em" }}>畫布預覽（拖曳重新排序，點擊聚焦）</div>
        <div style={{ display: "flex", gap: 6, color: "#82dca5", fontSize: 12 }}>
          <span style={{ borderLeft: "8px solid #4f8", paddingLeft: 6 }}>image/slide</span>
          <span style={{ borderLeft: "8px solid #ffb347", paddingLeft: 6 }}>video</span>
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gap: layoutGap || 0,
          border: "1px dashed #0f4",
          padding: 8,
          background: "#001100",
          minHeight: 160,
        }}
      >
        {(panels || []).map((panel, index) => {
          const { mode, asset } = getPanelModeAndAsset(panel);
          const preset = mode ? MODE_PRESETS[mode as PanelMode] : undefined;
          const isVideo = preset?.assetKey === "video";
          const isActive = selectedRows.includes(index);
          return (
            <div
              key={panel?.id || index}
              role="button"
              tabIndex={0}
              draggable
              onDragStart={(e) => handlePanelDrag(e, index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handlePanelDrop(e, index)}
              onClick={() => (typeof onSelectPanel === "function" ? onSelectPanel(index) : onToggleRow(index))}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  if (typeof onSelectPanel === "function") {
                    onSelectPanel(index);
                  }
                }
              }}
              style={{
                border: `2px solid ${isVideo ? "#ffb347" : "#4f8"}`,
                background: isActive ? "#0a280a" : "#010",
                color: "#e8ffe9",
                padding: 8,
                borderRadius: 4,
                gridColumnEnd: `span ${panel?.colSpan ?? panel?.col_span ?? 1}`,
                gridRowEnd: `span ${panel?.rowSpan ?? panel?.row_span ?? 1}`,
                boxShadow: isActive ? "0 0 0 2px #82dca5" : "none",
                cursor: "grab",
                minHeight: 72,
                display: "flex",
                flexDirection: "column",
                gap: 6,
                position: "relative",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 12, letterSpacing: "0.05em" }}>{panel?.id || `panel-${index + 1}`}</div>
              <div style={{ fontSize: 12, color: "#82dca5" }}>{mode || "自訂模式"}</div>
              <div style={{ fontSize: 12, color: "#c8ffd2", overflow: "hidden", textOverflow: "ellipsis" }}>
                {asset || panel?.image || panel?.url || "(未指定)"}
              </div>
              <div style={{ position: "absolute", bottom: 8, right: 8, display: "flex", gap: 4 }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const next = Math.max(1, (panel?.colSpan ?? panel?.col_span ?? 1) + 1);
                    onPanelChange(index, { colSpan: next, col_span: next });
                  }}
                  style={{ fontSize: 10 }}
                >
                  ↔︎+
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const next = Math.max(1, (panel?.rowSpan ?? panel?.row_span ?? 1) + 1);
                    onPanelChange(index, { rowSpan: next, row_span: next });
                  }}
                  style={{ fontSize: 10 }}
                >
                  ↕︎+
                </button>
              </div>
            </div>
          );
        })}
        {(!panels || panels.length === 0) && (
          <div style={{ color: "#82dca5" }} data-ai-state="empty">
            尚未新增 panel，點擊上方「新增 panel」或從資產抽屜拖曳
          </div>
        )}
      </div>
    </div>
  );
}
