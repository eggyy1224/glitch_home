import React from "react";
import type { PanelConfig } from "./types";
import type { PanelMode } from "./panelPresets";
import { PanelForm } from "./PanelForm";

interface PanelRowProps {
  index: number;
  panel: PanelConfig;
  selected: boolean;
  videoAssets: string[];
  imageAssets: string[];
  onPanelChange: (index: number, patch: Partial<PanelConfig>) => void;
  onModeSelect: (index: number, nextMode: PanelMode | "", currentAsset: string, panel?: PanelConfig, options?: { imgBase?: string | null }) => void;
  onAssetChange: (
    index: number,
    mode: PanelMode | "",
    assetValue: string,
    panel?: PanelConfig,
    options?: { imgBase?: string | null },
  ) => void;
  onImageChange: (
    index: number,
    value: string,
    panel?: PanelConfig,
    modeOverride?: PanelMode | "",
    imgBaseOverride?: string | null,
  ) => void;
  onToggleRow: (index: number) => void;
  onMoveRow: (index: number, delta: number) => void;
  onDuplicateRow: (index: number) => void;
  onRemoveRow: (index: number) => void;
  onSelectPanel?: (index: number) => void;
}

export function PanelRow({
  index,
  panel,
  selected,
  videoAssets,
  imageAssets,
  onPanelChange,
  onModeSelect,
  onAssetChange,
  onImageChange,
  onToggleRow,
  onMoveRow,
  onDuplicateRow,
  onRemoveRow,
  onSelectPanel,
}: PanelRowProps) {
  return (
    <div
      style={{
        border: "1px solid #0f4",
        borderRadius: 0,
        padding: 10,
        background: selected ? "#020" : "#000",
        boxShadow: "none",
      }}
      data-ai-item={`snapshot.panel:${index}`}
      onClick={() => (typeof onSelectPanel === "function" ? onSelectPanel(index) : null)}
    >
      <PanelForm
        index={index}
        panel={panel}
        videoAssets={videoAssets}
        imageAssets={imageAssets}
        onPanelChange={onPanelChange}
        onModeSelect={onModeSelect}
        onAssetChange={onAssetChange}
        onImageChange={onImageChange}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleRow(index)}
            onClick={(e) => e.stopPropagation()}
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
    </div>
  );
}
