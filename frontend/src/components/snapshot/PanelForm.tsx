import React from "react";
import type { PanelConfig } from "./types";
import type { PanelMode } from "./panelPresets";
import { getPanelModeAndAsset, mergePresetMode, MODE_PRESETS } from "./panelPresets";
import type { VideoPanelOptions } from "./videoPanelUtils";
import { buildVideoModeUrl, parseVideoPanelOptions } from "./videoPanelUtils";
import type { VjVideoPanelOptions } from "./vjVideoPanelUtils";
import { buildVjVideoModeUrl, parseVjVideoPanelOptions } from "./vjVideoPanelUtils";
import type { KinshipRelation, SlidePanelOptions, VjPanelOptions } from "./slidePanelUtils";
import {
  applySlideOptionsToParams,
  buildMatrixModeUrl,
  buildSlideModeUrl,
  buildVjModeUrl,
  mergeSlideOptions,
  parseSlidePanelOptions,
  parseVjPanelOptions,
} from "./slidePanelUtils";

interface PanelFormProps {
  index: number;
  panel: PanelConfig;
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
}

export function PanelForm({
  index,
  panel,
  videoAssets,
  imageAssets,
  bgmAssets,
  onPanelChange,
  onModeSelect,
  onAssetChange,
  onImageChange,
}: PanelFormProps) {
  const { mode, asset } = getPanelModeAndAsset(panel);
  const preset = mode ? MODE_PRESETS[mode as PanelMode] : undefined;
  const assetPlaceholder = preset?.assetKey === "video" ? "影片檔名.mp4" : "offspring_xxx.png";
  const assetListId = `snapshot-panel-${index}-asset-options`;
  const bgmListId = `snapshot-panel-${index}-bgm-options`;
  const assetList = preset?.assetKey === "video" ? videoAssets : imageAssets;
  const safeAssetList = Array.isArray(assetList) ? assetList : [];
  const safeBgmAssets = Array.isArray(bgmAssets) ? bgmAssets : [];
  const isVideoMode = mode === "video_mode";
  const isVjVideoMode = mode === "vj_video_mode";
  const isSlideMode = mode === "slide_mode";
  const isMatrixMode = mode === "matrix_mode";
  const isVjMode = mode === "vj_mode";
  const isSlideLikeMode = isSlideMode || isMatrixMode || isVjMode;
  const videoOptions = React.useMemo(() => (isVideoMode ? parseVideoPanelOptions(panel?.url) : undefined), [isVideoMode, panel?.url]);
  const vjVideoOptions = React.useMemo(() => (isVjVideoMode ? parseVjVideoPanelOptions(panel?.url) : undefined), [isVjVideoMode, panel?.url]);
  const slideOptions = React.useMemo(
    () => (isSlideMode || isMatrixMode ? parseSlidePanelOptions(panel?.url, panel?.params) : undefined),
    [isSlideMode, isMatrixMode, panel?.params, panel?.url],
  );
  const vjOptions = React.useMemo(() => (isVjMode ? parseVjPanelOptions(panel?.url, panel?.params) : undefined), [isVjMode, panel?.params, panel?.url]);
  const slideLikeOptions = isVjMode ? vjOptions : slideOptions;

  const mergeSlideParams = (patch?: Partial<SlidePanelOptions>): PanelConfig["params"] | undefined => {
    const baseParams = mergePresetMode(panel?.params, mode || "slide_mode") || {};
    const current = slideOptions || parseSlidePanelOptions(panel?.url, panel?.params);
    const merged = mergeSlideOptions(current, patch);
    return applySlideOptionsToParams(baseParams, merged);
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

  const handleVjVideoOptionChange = (patch: Partial<VjVideoPanelOptions>) => {
    if (!isVjVideoMode) return;
    const nextUrl = buildVjVideoModeUrl(panel?.url, patch);
    onPanelChange(index, { url: nextUrl });
  };

  const handleSlideOptionChange = (patch: Partial<SlidePanelOptions>) => {
    if (!isSlideLikeMode) return;
    const nextUrl = isVjMode
      ? buildVjModeUrl(panel?.url, patch, { panelParams: panel?.params, imgBase: slideLikeOptions?.imgBase })
      : isMatrixMode
      ? buildMatrixModeUrl(panel?.url, patch, { panelParams: panel?.params, imgBase: slideLikeOptions?.imgBase })
      : buildSlideModeUrl(panel?.url, patch, { panelParams: panel?.params, imgBase: slideLikeOptions?.imgBase });
    const patchPayload: Partial<PanelConfig> = {
      url: nextUrl,
      params: mergeSlideParams(patch),
    };
    onPanelChange(index, patchPayload);
  };

  const handleVjOptionChange = (patch: Partial<VjPanelOptions>) => {
    if (!isVjMode) return;
    const nextUrl = buildVjModeUrl(panel?.url, patch, { panelParams: panel?.params, imgBase: slideLikeOptions?.imgBase });
    onPanelChange(index, { url: nextUrl });
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
          placeholder="例如 /?slide_mode=true 或 /?matrix_mode=true 或 /?vj_mode=true 或 /?vj_video_mode=true"
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
      {isSlideLikeMode && (
        <div style={{ gridColumn: "1 / -1", borderTop: "1px solid #0f4", paddingTop: 8 }}>
          <div style={{ marginBottom: 6, color: "#82dca5" }}>{isVjMode ? "vj_mode 相似池參數（沿用 slide_mode）" : "slide/matrix 參數"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
            {!isVjMode && (
              <label style={{ display: "flex", flexDirection: "column" }}>
                輪播間隔 (毫秒)
                <input
                  type="number"
                  min="500"
                  step="100"
                  value={slideLikeOptions?.intervalMs ?? ""}
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
            <label style={{ display: "flex", flexDirection: "column" }}>
              結果數量 (top_k)
              <input
                type="number"
                min="1"
                step="1"
                value={slideLikeOptions?.topK ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  const parsed = raw === "" ? null : Number(raw);
                  const safeValue = parsed === null || Number.isNaN(parsed) ? null : Math.max(1, parsed);
                  handleSlideOptionChange({ topK: safeValue ?? undefined });
                }}
                placeholder="預設 15"
                data-ai-field={`snapshot.panel[${index}].slide_top_k`}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column" }}>
              資料來源
              <select
                value={slideLikeOptions?.slideSource ?? "vector"}
                onChange={(e) => handleSlideOptionChange({ slideSource: e.target.value as SlidePanelOptions["slideSource"] })}
                data-ai-field={`snapshot.panel[${index}].slide_source`}
              >
                <option value="vector">vector</option>
                <option value="kinship">kinship</option>
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column" }}>
              親緣深度 (kinship_depth)
              <input
                type="number"
                step="1"
                value={slideLikeOptions?.kinshipDepth ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  const parsed = raw === "" ? null : Number(raw);
                  const safeValue = parsed === null || Number.isNaN(parsed) ? null : parsed;
                  handleSlideOptionChange({ kinshipDepth: safeValue });
                }}
                placeholder="-1 代表取全部"
                data-ai-field={`snapshot.panel[${index}].kinship_depth`}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column" }}>
              親緣排序偏好 (逗號分隔)
              <input
                type="text"
                value={(slideLikeOptions?.kinshipOrder || []).join(",")}
                onChange={(e) => {
                  const raw = e.target.value;
                  const list = raw
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean) as KinshipRelation[];
                  handleSlideOptionChange({ kinshipOrder: list });
                }}
                placeholder="children,siblings,parents,ancestors"
                data-ai-field={`snapshot.panel[${index}].kinship_order`}
              />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={slideLikeOptions?.includeDeprecated ?? false}
                onChange={(e) => handleSlideOptionChange({ includeDeprecated: e.target.checked })}
                data-ai-field={`snapshot.panel[${index}].include_deprecated`}
              />
              包含 deprecated
            </label>
          </div>
        </div>
      )}
      {isVjMode && (
        <div style={{ gridColumn: "1 / -1", borderTop: "1px solid #0f4", paddingTop: 8 }}>
          <div style={{ marginBottom: 6, color: "#82dca5" }}>vj_mode 參數</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
            <label style={{ display: "flex", flexDirection: "column" }}>
              快速切換上限 vj_fast_ms
              <input
                type="number"
                min="80"
                step="10"
                value={vjOptions?.vjFastMs ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  const parsed = raw === "" ? null : Number(raw);
                  const safeValue = parsed === null || Number.isNaN(parsed) ? null : parsed;
                  handleVjOptionChange({ vjFastMs: safeValue });
                }}
                placeholder="預設 260"
                data-ai-field={`snapshot.panel[${index}].vj_fast_ms`}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column" }}>
              慢速切換下限 vj_slow_ms
              <input
                type="number"
                min="1000"
                step="100"
                value={vjOptions?.vjSlowMs ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  const parsed = raw === "" ? null : Number(raw);
                  const safeValue = parsed === null || Number.isNaN(parsed) ? null : parsed;
                  handleVjOptionChange({ vjSlowMs: safeValue });
                }}
                placeholder="預設 15000"
                data-ai-field={`snapshot.panel[${index}].vj_slow_ms`}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column" }}>
              漂移強度 vj_drift (0-2)
              <input
                type="number"
                min="0"
                max="2"
                step="0.05"
                value={vjOptions?.vjDrift ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  const parsed = raw === "" ? null : Number(raw);
                  const safeValue = parsed === null || Number.isNaN(parsed) ? null : parsed;
                  handleVjOptionChange({ vjDrift: safeValue });
                }}
                placeholder="預設 1.0"
                data-ai-field={`snapshot.panel[${index}].vj_drift`}
              />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={vjOptions?.vjAutostartMic ?? false}
                onChange={(e) => handleVjOptionChange({ vjAutostartMic: e.target.checked })}
                data-ai-field={`snapshot.panel[${index}].vj_autostart_mic`}
              />
              自動啟動麥克風 (vj_autostart_mic)
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={vjOptions?.vjDebug ?? false}
                onChange={(e) => handleVjOptionChange({ vjDebug: e.target.checked })}
                data-ai-field={`snapshot.panel[${index}].vj_debug`}
              />
              顯示 debug 面板 (vj_debug)
            </label>
          </div>
          <div style={{ marginTop: 10, borderTop: "1px dashed rgba(130, 220, 165, 0.4)", paddingTop: 8 }}>
            <div style={{ marginBottom: 6, color: "#82dca5", fontSize: 12 }}>BGM 驅動模式（設定後會取代麥克風）</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
              <label style={{ display: "flex", flexDirection: "column" }}>
                BGM 檔名 (vj_bgm)
                <input
                  type="text"
                  value={vjOptions?.vjBgm ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    handleVjOptionChange({ vjBgm: raw || null });
                  }}
                  placeholder="heavy_metal_bgm_03.mp3"
                  list={safeBgmAssets.length ? bgmListId : undefined}
                  data-ai-field={`snapshot.panel[${index}].vj_bgm`}
                />
                {safeBgmAssets.length > 0 && (
                  <datalist id={bgmListId}>
                    {safeBgmAssets.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                )}
              </label>
              <label style={{ display: "flex", flexDirection: "column" }}>
                BGM 音量 (0-1)
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  value={vjOptions?.vjBgmVolume ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const parsed = raw === "" ? null : Number(raw);
                    const safeValue = parsed === null || Number.isNaN(parsed) ? null : Math.max(0, Math.min(1, parsed));
                    handleVjOptionChange({ vjBgmVolume: safeValue });
                  }}
                  placeholder="預設 0.6"
                  data-ai-field={`snapshot.panel[${index}].vj_bgm_volume`}
                />
              </label>
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>
              提示：BGM 檔案放在 /bgm/ 資料夾（例如 heavy_metal_bgm_03.mp3、星際狂舞.mp3）
            </div>
          </div>
        </div>
      )}
      {isVjVideoMode && (
        <div style={{ gridColumn: "1 / -1", borderTop: "1px solid #0f4", paddingTop: 8 }}>
          <div style={{ marginBottom: 6, color: "#82dca5" }}>vj_video_mode 參數</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
            <label style={{ display: "flex", flexDirection: "column" }}>
              速度下限 vj_video_rate_min
              <input
                type="number"
                min="0.1"
                max="4"
                step="0.05"
                value={vjVideoOptions?.vjVideoRateMin ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  const parsed = raw === "" ? null : Number(raw);
                  const safeValue = parsed === null || Number.isNaN(parsed) ? null : parsed;
                  handleVjVideoOptionChange({ vjVideoRateMin: safeValue });
                }}
                placeholder="預設 0.55"
                data-ai-field={`snapshot.panel[${index}].vj_video_rate_min`}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column" }}>
              速度上限 vj_video_rate_max
              <input
                type="number"
                min="0.2"
                max="6"
                step="0.05"
                value={vjVideoOptions?.vjVideoRateMax ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  const parsed = raw === "" ? null : Number(raw);
                  const safeValue = parsed === null || Number.isNaN(parsed) ? null : parsed;
                  handleVjVideoOptionChange({ vjVideoRateMax: safeValue });
                }}
                placeholder="預設 1.8"
                data-ai-field={`snapshot.panel[${index}].vj_video_rate_max`}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column" }}>
              跳段下限 vj_video_jump_min (秒)
              <input
                type="number"
                min="0.05"
                max="10"
                step="0.05"
                value={vjVideoOptions?.vjVideoJumpMin ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  const parsed = raw === "" ? null : Number(raw);
                  const safeValue = parsed === null || Number.isNaN(parsed) ? null : parsed;
                  handleVjVideoOptionChange({ vjVideoJumpMin: safeValue });
                }}
                placeholder="預設 0.25"
                data-ai-field={`snapshot.panel[${index}].vj_video_jump_min`}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column" }}>
              跳段上限 vj_video_jump_max (秒)
              <input
                type="number"
                min="0.1"
                max="20"
                step="0.1"
                value={vjVideoOptions?.vjVideoJumpMax ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  const parsed = raw === "" ? null : Number(raw);
                  const safeValue = parsed === null || Number.isNaN(parsed) ? null : parsed;
                  handleVjVideoOptionChange({ vjVideoJumpMax: safeValue });
                }}
                placeholder="預設 2.8"
                data-ai-field={`snapshot.panel[${index}].vj_video_jump_max`}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column" }}>
              換片門檻 vj_video_swap_threshold (0-1)
              <input
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={vjVideoOptions?.vjVideoSwapThreshold ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  const parsed = raw === "" ? null : Number(raw);
                  const safeValue = parsed === null || Number.isNaN(parsed) ? null : parsed;
                  handleVjVideoOptionChange({ vjVideoSwapThreshold: safeValue });
                }}
                placeholder="預設 0.7"
                data-ai-field={`snapshot.panel[${index}].vj_video_swap_threshold`}
              />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={vjVideoOptions?.vjVideoShuffle !== false}
                onChange={(e) => handleVjVideoOptionChange({ vjVideoShuffle: e.target.checked })}
                data-ai-field={`snapshot.panel[${index}].vj_video_shuffle`}
              />
              高強度 beat 時換片 (vj_video_shuffle)
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={vjVideoOptions?.vjAutostartMic ?? false}
                onChange={(e) => handleVjVideoOptionChange({ vjAutostartMic: e.target.checked })}
                data-ai-field={`snapshot.panel[${index}].vj_autostart_mic`}
              />
              自動啟動麥克風 (vj_autostart_mic)
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={vjVideoOptions?.vjDebug ?? false}
                onChange={(e) => handleVjVideoOptionChange({ vjDebug: e.target.checked })}
                data-ai-field={`snapshot.panel[${index}].vj_debug`}
              />
              顯示 debug 面板 (vj_debug)
            </label>
          </div>
          <div style={{ marginTop: 10, borderTop: "1px dashed rgba(130, 220, 165, 0.4)", paddingTop: 8 }}>
            <div style={{ marginBottom: 6, color: "#82dca5", fontSize: 12 }}>BGM 驅動模式（設定後會取代麥克風）</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
              <label style={{ display: "flex", flexDirection: "column" }}>
                BGM 檔名 (vj_bgm)
                <input
                  type="text"
                  value={vjVideoOptions?.vjBgm ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    handleVjVideoOptionChange({ vjBgm: raw || null });
                  }}
                  placeholder="heavy_metal_bgm_03.mp3"
                  list={safeBgmAssets.length ? bgmListId : undefined}
                  data-ai-field={`snapshot.panel[${index}].vj_bgm`}
                />
                {safeBgmAssets.length > 0 && (
                  <datalist id={bgmListId}>
                    {safeBgmAssets.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                )}
              </label>
              <label style={{ display: "flex", flexDirection: "column" }}>
                BGM 音量 (0-1)
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  value={vjVideoOptions?.vjBgmVolume ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const parsed = raw === "" ? null : Number(raw);
                    const safeValue = parsed === null || Number.isNaN(parsed) ? null : Math.max(0, Math.min(1, parsed));
                    handleVjVideoOptionChange({ vjBgmVolume: safeValue });
                  }}
                  placeholder="預設 0.6"
                  data-ai-field={`snapshot.panel[${index}].vj_bgm_volume`}
                />
              </label>
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>
              提示：BGM 檔案放在 /bgm/ 資料夾（例如 heavy_metal_bgm_03.mp3、星際狂舞.mp3）
            </div>
          </div>
        </div>
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
