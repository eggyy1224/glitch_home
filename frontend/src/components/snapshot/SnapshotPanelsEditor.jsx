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
  layoutColumns = 1,
  layoutGap = 0,
  onSelectPanel,
}) {
  const [imageAssets, setImageAssets] = useState([]);
  const [videoAssets, setVideoAssets] = useState([]);
  const [assetStatus, setAssetStatus] = useState("尚未載入資產");
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [assetTab, setAssetTab] = useState("images");
  const [assetKeyword, setAssetKeyword] = useState("");
  const [assetDrawerOpen, setAssetDrawerOpen] = useState(true);

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

  const filteredAssets = useMemo(() => {
    const keyword = assetKeyword.trim().toLowerCase();
    const source = assetTab === "videos" ? limitedVideoOptions : limitedImageOptions;
    if (!keyword) return source;
    return source.filter((name) => name.toLowerCase().includes(keyword));
  }, [assetKeyword, assetTab, limitedImageOptions, limitedVideoOptions]);

  const assetPreviewUrl = (name) => {
    if (!name) return "";
    if (assetTab === "videos") return "";
    if (name.startsWith("http")) return name;
    return `/generated_images/${name}`;
  };

  const handleModeSelect = (index, nextMode, currentAsset, panel) => {
    if (!nextMode) {
      onPanelChange(index, { url: "", image: undefined });
      return;
    }
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

  const applyAssetToPanel = (index, asset) => {
    if (!asset || index == null || index < 0) return;
    const panel = panels?.[index];
    const { mode } = getPanelModeAndAsset(panel);
    if (assetTab === "videos") {
      const nextMode = mode || "video_mode";
      handleModeSelect(index, nextMode, asset, panel);
    } else {
      const nextMode = mode || "static_mode";
      handleModeSelect(index, nextMode, asset, panel);
      handleImageChange(index, asset, panel);
    }
    if (typeof onSelectPanel === "function") {
      onSelectPanel(index);
    }
  };

  const handleAssetApply = (asset) => {
    if (!asset || !selectedRows.length) return;
    applyAssetToPanel(selectedRows[0], asset);
  };

  const handlePanelDrag = (event, index) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  };

  const handlePanelDrop = (event, targetIndex) => {
    const raw = event.dataTransfer.getData("text/plain");
    if (!raw) return;
    const from = Number(raw);
    if (Number.isNaN(from)) {
      applyAssetToPanel(targetIndex, raw);
      return;
    }
    if (from === targetIndex) return;

    const rect = event.currentTarget?.getBoundingClientRect?.();
    const dropAfter =
      rect != null
        ? event.clientY - rect.top > rect.height / 2 || event.clientX - rect.left > rect.width / 2
        : targetIndex > from; // fallback: when moving downward, default to drop-after

    let insertIndex = null;
    if (targetIndex > from) {
      const isAdjacent = targetIndex === from + 1;
      insertIndex = isAdjacent ? targetIndex : dropAfter ? targetIndex : targetIndex - 1; // adjacent downward always moves
    } else if (targetIndex < from) {
      insertIndex = dropAfter ? targetIndex + 1 : targetIndex;
    }
    if (insertIndex == null) return;

    const maxIndex = Math.max(0, (panels?.length || 1) - 1);
    const clampedIndex = Math.max(0, Math.min(insertIndex, maxIndex));
    onMoveRow(from, clampedIndex - from);
    if (typeof onSelectPanel === "function") {
      onSelectPanel(clampedIndex);
    }
  };

  const renderCanvas = () => {
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
            const isVideo = MODE_PRESETS[mode]?.assetKey === "video";
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
                <div style={{ fontWeight: 700, fontSize: 12, letterSpacing: "0.05em" }}>
                  {panel?.id || `panel-${index + 1}`}
                </div>
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
  };

  return (
    <div data-ai-section="snapshot.panels">
      {renderCanvas()}
      <div
        style={{
          border: "1px solid #0f4",
          marginBottom: 12,
          background: "#010",
          padding: 10,
          borderRadius: 4,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
          <button type="button" onClick={() => setAssetDrawerOpen((prev) => !prev)}>
            {assetDrawerOpen ? "收合資產抽屜" : "展開資產抽屜"}
          </button>
          <div style={{ color: "#82dca5" }}>直接拖放或點擊套用到選取 panel，免去手動輸入</div>
        </div>
        {assetDrawerOpen && (
          <div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <button
                type="button"
                onClick={() => setAssetTab("images")}
                style={{
                  padding: "6px 10px",
                  background: assetTab === "images" ? "#0f4" : "#000",
                  color: assetTab === "images" ? "#000" : "#c8ffd2",
                  border: "1px solid #0f4",
                  borderRadius: 4,
                }}
              >
                Images
              </button>
              <button
                type="button"
                onClick={() => setAssetTab("videos")}
                style={{
                  padding: "6px 10px",
                  background: assetTab === "videos" ? "#0f4" : "#000",
                  color: assetTab === "videos" ? "#000" : "#c8ffd2",
                  border: "1px solid #0f4",
                  borderRadius: 4,
                }}
              >
                Videos
              </button>
              <input
                type="text"
                placeholder="搜尋名稱..."
                value={assetKeyword}
                onChange={(e) => setAssetKeyword(e.target.value)}
                style={{ width: 200 }}
              />
              <span style={{ color: "#82dca5" }}>{assetStatus}</span>
              <button type="button" onClick={loadAssets} disabled={loadingAssets}>
                重新載入資產
              </button>
              <button type="button" onClick={() => handleAssetApply(filteredAssets[0])} disabled={!selectedRows.length}>
                套用到選取 panel
              </button>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 8,
                maxHeight: 220,
                overflowY: "auto",
                padding: 4,
                border: "1px dashed #0f4",
              }}
            >
              {(filteredAssets || []).map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => handleAssetApply(name)}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", name);
                  }}
                  style={{
                    textAlign: "left",
                    border: "1px solid #0f4",
                    background: "#000",
                    color: "#c8ffd2",
                    borderRadius: 6,
                    padding: 6,
                  }}
                >
                  <div
                    style={{
                      height: 72,
                      background: `url(${assetPreviewUrl(name)}) center/cover, linear-gradient(135deg, #0f4, #053)`,
                      borderRadius: 4,
                      marginBottom: 6,
                    }}
                    aria-hidden="true"
                  />
                  <div style={{ fontWeight: 700, fontSize: 12 }}>{name}</div>
                  <div style={{ fontSize: 11, color: "#82dca5" }}>{assetTab === "videos" ? "video" : "image"}</div>
                </button>
              ))}
              {filteredAssets.length === 0 && (
                <div style={{ color: "#82dca5" }} data-ai-state="empty">
                  無符合的資產，請嘗試重新載入或調整搜尋關鍵字
                </div>
              )}
            </div>
          </div>
        )}
      </div>
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
        <span
          style={{ color: "#82dca5" }}
          role="status"
          aria-live="polite"
          id="snapshot.assets.status"
          data-ai-id="snapshot.assets.status"
        >
          資產：{assetStatus}
        </span>
        <button
          type="button"
          onClick={loadAssets}
          disabled={loadingAssets}
          data-ai-action="snapshot.panel.assets.reload"
        >
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
            onClick={() => (typeof onSelectPanel === "function" ? onSelectPanel(index) : null)}
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
