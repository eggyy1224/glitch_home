import React from "react";
import type { PanelConfig } from "./types";
import type { PanelMode } from "./panelPresets";
import { getPanelModeAndAsset, MODE_PRESETS } from "./panelPresets";

interface PanelFormProps {
  index: number;
  panel: PanelConfig;
  videoAssets: string[];
  imageAssets: string[];
  onPanelChange: (index: number, patch: Partial<PanelConfig>) => void;
  onModeSelect: (index: number, nextMode: PanelMode | "", currentAsset: string, panel?: PanelConfig) => void;
  onAssetChange: (index: number, mode: PanelMode | "", assetValue: string, panel?: PanelConfig) => void;
  onImageChange: (index: number, value: string, panel?: PanelConfig) => void;
}

export function PanelForm({
  index,
  panel,
  videoAssets,
  imageAssets,
  onPanelChange,
  onModeSelect,
  onAssetChange,
  onImageChange,
}: PanelFormProps) {
  const { mode, asset } = getPanelModeAndAsset(panel);
  const preset = mode ? MODE_PRESETS[mode as PanelMode] : undefined;
  const assetPlaceholder = preset?.assetKey === "video" ? "影片檔名.mp4" : "offspring_xxx.png";
  const assetListId = `snapshot-panel-${index}-asset-options`;
  const assetList = preset?.assetKey === "video" ? videoAssets : imageAssets;
  const safeAssetList = Array.isArray(assetList) ? assetList : [];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 8,
        marginBottom: 8,
      }}
    >
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
        模式
        <select
          value={mode}
          onChange={(e) => onModeSelect(index, e.target.value as PanelMode | "", asset, panel)}
          data-ai-field={`snapshot.panel[${index}].mode`}
        >
          <option value="">手動輸入</option>
          {Object.entries(MODE_PRESETS).map(([value, meta]) => (
            <option key={value} value={value}>
              {meta.label}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: "flex", flexDirection: "column" }}>
        資產（依模式）
        <input
          type="text"
          value={asset || ""}
          onChange={(e) => onAssetChange(index, mode, e.target.value, panel)}
          placeholder={assetPlaceholder}
          disabled={!mode}
          list={safeAssetList.length ? assetListId : undefined}
          aria-describedby="snapshot.assets.status"
          data-ai-field={`snapshot.panel[${index}].asset`}
        />
        {safeAssetList.length > 0 && (
          <datalist id={assetListId}>
            {safeAssetList.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        )}
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
          onChange={(e) => onImageChange(index, e.target.value, panel)}
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
          onChange={(e) => {
            const val = e.target.value;
            onPanelChange(index, { ratio: val === "" ? undefined : Number(val) });
          }}
          data-ai-field={`snapshot.panel[${index}].ratio`}
        />
      </label>
      <label style={{ display: "flex", flexDirection: "column" }}>
        colSpan
        <input
          type="number"
          min="1"
          value={panel?.colSpan ?? panel?.col_span ?? ""}
          onChange={(e) => {
            const val = e.target.value;
            const resolved = val === "" ? undefined : Number(val);
            onPanelChange(index, { colSpan: resolved, col_span: resolved });
          }}
          data-ai-field={`snapshot.panel[${index}].colSpan`}
        />
      </label>
      <label style={{ display: "flex", flexDirection: "column" }}>
        rowSpan
        <input
          type="number"
          min="1"
          value={panel?.rowSpan ?? panel?.row_span ?? ""}
          onChange={(e) => {
            const val = e.target.value;
            const resolved = val === "" ? undefined : Number(val);
            onPanelChange(index, { rowSpan: resolved, row_span: resolved });
          }}
          data-ai-field={`snapshot.panel[${index}].rowSpan`}
        />
      </label>
    </div>
  );
}
