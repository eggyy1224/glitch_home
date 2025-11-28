import React, { useCallback, useEffect, useMemo, useState } from "react";
import { listOffspringImages, listVideoAssets } from "../../api.js";

const MODE_PRESETS = {
  slide_mode: { assetKey: "img", label: "slide_mode (輪播)" },
  static_mode: { assetKey: "img", label: "static_mode (單張)" },
  video_mode: { assetKey: "video", label: "video_mode (影片)" },
};

const truthy = (value) => {
  if (value == null) return false;
  const text = String(value).toLowerCase();
  return text === "true" || text === "1" || text === "yes";
};

const getPanelModeAndAsset = (panel) => {
  let mode = "";
  let asset = panel?.image || "";
  const base = typeof window !== "undefined" ? window.location.origin : "http://localhost";
  if (panel?.url) {
    try {
      const parsed = new URL(panel.url, base);
      const params = parsed.searchParams;
      Object.keys(MODE_PRESETS).some((key) => {
        if (!truthy(params.get(key))) return false;
        mode = key;
        const assetKey = MODE_PRESETS[key].assetKey;
        asset = params.get(assetKey) || asset;
        return true;
      });
      if (!mode) {
        const imgParam = params.get("img");
        if (imgParam) {
          asset = imgParam;
        }
      }
    } catch (err) {
      // ignore parse errors and fall back to manual inputs
    }
  }
  if (!mode && panel?.image) {
    mode = "static_mode";
  }
  return { mode, asset };
};

const buildUrlFromPreset = (mode, asset) => {
  const preset = MODE_PRESETS[mode];
  if (!preset) return "";
  const qs = new URLSearchParams();
  qs.set(mode, "true");
  if (asset) {
    qs.set(preset.assetKey, asset);
  }
  return `/?${qs.toString()}`;
};

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
  const [imageAssets, setImageAssets] = useState([]);
  const [videoAssets, setVideoAssets] = useState([]);
  const [assetStatus, setAssetStatus] = useState("尚未載入資產");
  const [loadingAssets, setLoadingAssets] = useState(false);

  const parseAssetList = useCallback((rawList) => {
    const list = Array.isArray(rawList) ? rawList : [];
    const seen = new Set();
    const names = [];
    list.forEach((item) => {
      let candidate = "";
      if (typeof item === "string") {
        candidate = item;
      } else if (item && typeof item === "object") {
        candidate =
          item.name ||
          item.basename ||
          item.filename ||
          (typeof item.url === "string" ? item.url.split("/").pop() : "");
      }
      if (candidate && !seen.has(candidate)) {
        seen.add(candidate);
        names.push(candidate);
      }
    });
    return names;
  }, []);

  const loadAssets = useCallback(async () => {
    try {
      setLoadingAssets(true);
      setAssetStatus("載入資產中...");
      const [imgRes, videoRes] = await Promise.all([listOffspringImages(), listVideoAssets()]);
      const images = parseAssetList(imgRes?.images ?? imgRes);
      const videos = parseAssetList(videoRes?.videos ?? videoRes);
      setImageAssets(images);
      setVideoAssets(videos);
      setAssetStatus(`圖片 ${images.length} / 影片 ${videos.length}`);
    } catch (err) {
      setAssetStatus(err?.message || "載入資產失敗");
    } finally {
      setLoadingAssets(false);
    }
  }, [parseAssetList]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  const limitedImageOptions = useMemo(() => imageAssets.slice(0, 500), [imageAssets]);
  const limitedVideoOptions = useMemo(() => videoAssets.slice(0, 500), [videoAssets]);

  const handleModeSelect = (index, nextMode, currentAsset, panel) => {
    if (!nextMode) return;
    const nextUrl = buildUrlFromPreset(nextMode, currentAsset);
    const patch = { url: nextUrl };
    if (MODE_PRESETS[nextMode]?.assetKey === "img") {
      patch.image = currentAsset || panel?.image || undefined;
    }
    onPanelChange(index, patch);
  };

  const handleAssetChange = (index, mode, assetValue, panel) => {
    if (mode && MODE_PRESETS[mode]) {
      const nextUrl = buildUrlFromPreset(mode, assetValue);
      const patch = { url: nextUrl };
      if (MODE_PRESETS[mode].assetKey === "img") {
        patch.image = assetValue || undefined;
      }
      onPanelChange(index, patch);
    } else {
      onPanelChange(index, { url: assetValue || panel?.url || "" });
    }
  };

  const handleImageChange = (index, value, panel) => {
    const { mode } = getPanelModeAndAsset(panel);
    const isImageMode = MODE_PRESETS[mode]?.assetKey === "img";
    const patch = { image: value };
    if (isImageMode) {
      patch.url = buildUrlFromPreset(mode, value);
    }
    onPanelChange(index, patch);
  };

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
        <span style={{ color: "#82dca5" }}>資產：{assetStatus}</span>
        <button type="button" onClick={loadAssets} disabled={loadingAssets} data-ai-action="snapshot.panel.assets.reload">
          重新載入資產
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {(panels || []).map((panel, index) => (
          // eslint-disable-next-line react/no-array-index-key
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
            {(() => {
              const { mode, asset } = getPanelModeAndAsset(panel);
              const preset = MODE_PRESETS[mode];
              const assetPlaceholder = preset?.assetKey === "video" ? "影片檔名.mp4" : "offspring_xxx.png";
              const assetListId = `snapshot-panel-${index}-asset-options`;
              const assetList =
                MODE_PRESETS[mode]?.assetKey === "video" ? limitedVideoOptions : limitedImageOptions;
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
                      onChange={(e) => handleModeSelect(index, e.target.value, asset, panel)}
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
                        onChange={(e) => handleAssetChange(index, mode, e.target.value, panel)}
                        placeholder={assetPlaceholder}
                        disabled={!mode}
                        list={safeAssetList.length ? assetListId : undefined}
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
                      onChange={(e) => handleImageChange(index, e.target.value, panel)}
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
            })()}

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
