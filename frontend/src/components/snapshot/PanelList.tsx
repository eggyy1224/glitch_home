import React, { useMemo } from "react";
import type { PanelConfig } from "./types";
import type { PanelMode } from "./panelPresets";
import { PanelRow } from "./PanelRow";
import { createPanelKeyResolver } from "./panelKeyUtils";

interface PanelListProps {
  panels: PanelConfig[];
  selectedRows: number[];
  videoAssets: string[];
  imageAssets: string[];
  bgmAssets: string[];
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

export function PanelList({
  panels,
  selectedRows,
  videoAssets,
  imageAssets,
  bgmAssets,
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
  const keyForPanel = useMemo(() => createPanelKeyResolver(panels), [panels]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {(panels || []).map((panel, index) => (
        <PanelRow
          // id 唯一時保持穩定 key；只有在缺 id 或重複 id 時才帶 index 以避免殘留
          key={keyForPanel(panel, index)}
          index={index}
          panel={panel}
          selected={selectedRows.includes(index)}
          videoAssets={videoAssets}
          imageAssets={imageAssets}
          bgmAssets={bgmAssets}
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
