import React from "react";
import type { PanelConfig } from "./types";
import type { PanelMode } from "./panelPresets";
import { getPanelModeAndAsset, mergePresetMode, MODE_PRESETS } from "./panelPresets";
import type { VideoPanelOptions } from "./videoPanelUtils";
import { buildVideoModeUrl, parseVideoPanelOptions } from "./videoPanelUtils";
import type { SlidePanelOptions } from "./slidePanelUtils";
import { buildSlideModeUrl, parseSlidePanelOptions } from "./slidePanelUtils";

interface PanelFormProps {
  index: number;
  panel: PanelConfig;
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
  const isVideoMode = mode === "video_mode";
  const isSlideMode = mode === "slide_mode";
  const videoOptions = React.useMemo(() => (isVideoMode ? parseVideoPanelOptions(panel?.url) : undefined), [isVideoMode, panel?.url]);
  const slideOptions = React.useMemo(
    () => (isSlideMode ? parseSlidePanelOptions(panel?.url, panel?.params) : undefined),
    [isSlideMode, panel?.params, panel?.url],
  );

  const mergeSlideParams = (intervalMs?: number | null): PanelConfig["params"] | undefined => {
    const baseParams = mergePresetMode(panel?.params, "slide_mode") || {};
    const nextParams = { ...baseParams } as Record<string, unknown>;
    if (intervalMs !== undefined) {
      if (intervalMs === null) {
        delete nextParams.slide_interval;
        delete nextParams.slide_interval_ms;
      } else {
        const safeValue = Math.max(0, Math.floor(intervalMs));
        nextParams.slide_interval = String(safeValue);
        nextParams.slide_interval_ms = String(safeValue);
      }
    }
    return Object.keys(nextParams).length ? nextParams : undefined;
  };

  const handleVideoOptionChange = (patch: Partial<VideoPanelOptions>) => {
    if (!isVideoMode) return;
    const nextUrl = buildVideoModeUrl(panel?.url, patch);
    const patchPayload: Partial<PanelConfig> = {
      url: nextUrl,
      params: panel?.params,
    };
    onPanelChange(index, patchPayload);
  };

  const handleSlideOptionChange = (patch: Partial<SlidePanelOptions>) => {
    if (!isSlideMode) return;
    const nextUrl = buildSlideModeUrl(panel?.url, patch, { panelParams: panel?.params, imgBase: slideOptions?.imgBase });
    const patchPayload: Partial<PanelConfig> = {
      url: nextUrl,
      params: mergeSlideParams(patch.intervalMs),
    };
    onPanelChange(index, patchPayload);
  };

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
      {isSlideMode && (
        <label style={{ display: "flex", flexDirection: "column" }}>
          輪播間隔 (毫秒)
          <input
            type="number"
            min="500"
            step="100"
            value={slideOptions?.intervalMs ?? ""}
            onChange={(e) => {
              const raw = e.target.value;
              const parsed = raw === "" ? null : Number(raw);
              const safeValue = parsed === null || Number.isNaN(parsed) ? null : parsed;
              handleSlideOptionChange({ intervalMs: safeValue });
            }}
            placeholder="預設 3000"
            data-ai-field={`snapshot.panel[${index}].slide_interval_ms`}
          />
        </label>
      )}
      {isVideoMode && (
        <div style={{ gridColumn: "1 / -1", borderTop: "1px solid #0f4", paddingTop: 8 }}>
          <div style={{ marginBottom: 6, color: "#82dca5" }}>video_mode 參數</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
            <label style={{ display: "flex", flexDirection: "column" }}>
              速度 (0.07-4)
              <input
                type="number"
                min="0.07"
                max="4"
                step="0.01"
                value={videoOptions?.speed ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  const parsed = raw === "" ? null : Math.max(0.07, Math.min(4, Number(raw)));
                  handleVideoOptionChange({ speed: parsed });
                }}
                placeholder="預設 1.0"
                data-ai-field={`snapshot.panel[${index}].video_speed`}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column" }}>
              初始音量 (0-1)
              <input
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={videoOptions?.volume ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  const parsed = raw === "" ? null : Math.max(0, Math.min(1, Number(raw)));
                  handleVideoOptionChange({ volume: parsed });
                }}
                placeholder="預設 0.7"
                data-ai-field={`snapshot.panel[${index}].video_volume`}
              />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={videoOptions?.autoUnmute ?? true}
                onChange={(e) => handleVideoOptionChange({ autoUnmute: e.target.checked })}
                data-ai-field={`snapshot.panel[${index}].auto_unmute`}
              />
              自動解除靜音
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={videoOptions?.loop ?? true}
                onChange={(e) => handleVideoOptionChange({ loop: e.target.checked })}
                data-ai-field={`snapshot.panel[${index}].loop`}
              />
              循環播放
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
