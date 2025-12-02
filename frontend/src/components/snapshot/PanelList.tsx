import React from "react";
import type { PanelConfig } from "./types";
import type { PanelMode } from "./panelPresets";
import { PanelRow } from "./PanelRow";

interface PanelListProps {
  panels: PanelConfig[];
  selectedRows: number[];
  videoAssets: string[];
  imageAssets: string[];
  onPanelChange: (index: number, patch: Partial<PanelConfig>) => void;
  onModeSelect: (index: number, nextMode: PanelMode | "", currentAsset: string, panel?: PanelConfig) => void;
  onAssetChange: (index: number, mode: PanelMode | "", assetValue: string, panel?: PanelConfig) => void;
  onImageChange: (index: number, value: string, panel?: PanelConfig) => void;
  onToggleRow: (index: number) => void;
  onMoveRow: (index: number, delta: number) => void;
  onDuplicateRow: (index: number) => void;
  onRemoveRow: (index: number) => void;
  onSelectPanel?: (index: number) => void;
}

export function PanelList({
  panels,
  selectedRows,
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
}: PanelListProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {(panels || []).map((panel, index) => (
        <PanelRow
          // eslint-disable-next-line react/no-array-index-key
          key={panel?.id || index}
          index={index}
          panel={panel}
          selected={selectedRows.includes(index)}
          videoAssets={videoAssets}
          imageAssets={imageAssets}
          onPanelChange={onPanelChange}
          onModeSelect={onModeSelect}
          onAssetChange={onAssetChange}
          onImageChange={onImageChange}
          onToggleRow={onToggleRow}
          onMoveRow={onMoveRow}
          onDuplicateRow={onDuplicateRow}
          onRemoveRow={onRemoveRow}
          onSelectPanel={onSelectPanel}
        />
      ))}
      {(!panels || panels.length === 0) && (
        <div style={{ color: "#82dca5" }} data-ai-state="empty">
          尚未新增 panel
        </div>
      )}
    </div>
  );
}
