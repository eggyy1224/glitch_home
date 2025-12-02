import React from "react";
import { resizerHandleStyle, resizerHitboxStyle } from "../../AdminPanelStyles";
import { ASSET_DRAG_TYPE, ASSET_TYPE_DRAG_TYPE } from "./useSnapshotPanelDnd";
import type { AssetSearchMode, AssetTab } from "./types";

interface AssetDrawerProps {
  open: boolean;
  assetTab: AssetTab;
  assetKeyword: string;
  assetDrawerHeight: number;
  assetStatus: string;
  assetSearchMode: AssetSearchMode;
  semanticResults: string[];
  assetSearchError: string | null;
  searchingSemantic: boolean;
  loadingAssets: boolean;
  filteredAssets: string[];
  selectedRows: number[];
  onToggle: () => void;
  onTabChange: (tab: AssetTab) => void;
  onKeywordChange: (value: string) => void;
  onSearch: () => void;
  onClearSearch: () => void;
  onReload: () => void;
  onApplyAsset: (asset: string) => void;
  onResizeStart: (event: React.MouseEvent<HTMLDivElement>) => void;
  assetPreviewUrl: (name: string, tab: AssetTab) => string;
}

export function AssetDrawer({
  open,
  assetTab,
  assetKeyword,
  assetDrawerHeight,
  assetStatus,
  assetSearchMode,
  semanticResults,
  assetSearchError,
  searchingSemantic,
  loadingAssets,
  filteredAssets,
  selectedRows,
  onToggle,
  onTabChange,
  onKeywordChange,
  onSearch,
  onClearSearch,
  onReload,
  onApplyAsset,
  onResizeStart,
  assetPreviewUrl,
}: AssetDrawerProps) {
  return (
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
        <button type="button" onClick={onToggle}>
          {open ? "收合資產抽屜" : "展開資產抽屜"}
        </button>
        <div style={{ color: "#82dca5" }}>直接拖放或點擊套用到選取 panel，免去手動輸入</div>
      </div>
      {open && (
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
            <button
              type="button"
              onClick={() => onTabChange("images")}
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
              onClick={() => onTabChange("videos")}
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
              onChange={(e) => onKeywordChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onSearch();
                }
              }}
              style={{ width: 220 }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <button type="button" onClick={onSearch} disabled={assetTab === "videos" || searchingSemantic}>
                {searchingSemantic ? "搜尋中..." : assetTab === "videos" ? "語意搜尋停用" : "語意搜尋"}
              </button>
              <button type="button" onClick={onClearSearch} disabled={semanticResults.length === 0 && assetSearchMode !== "semantic"}>
                清除搜尋
              </button>
              <span style={{ color: "#82dca5" }}>
                {assetSearchMode === "semantic" && assetTab === "images"
                  ? `語意結果 ${semanticResults.length} 筆`
                  : assetStatus}
              </span>
              {assetSearchError && <span style={{ color: "#ffb347" }}>{assetSearchError}</span>}
            </div>
            <button type="button" onClick={onReload} disabled={loadingAssets}>
              重新載入資產
            </button>
            <button type="button" onClick={() => onApplyAsset(filteredAssets[0])} disabled={!selectedRows.length}>
              套用到選取 panel
            </button>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: 8,
              height: assetDrawerHeight,
              minHeight: 160,
              overflowY: "auto",
              padding: 4,
              border: "1px dashed #0f4",
            }}
          >
            {(filteredAssets || []).map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => onApplyAsset(name)}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(ASSET_DRAG_TYPE, name);
                  e.dataTransfer.setData(ASSET_TYPE_DRAG_TYPE, assetTab === "videos" ? "video" : "image");
                  e.dataTransfer.setData("text/plain", `asset:${name}`);
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
                    background: `url(${assetPreviewUrl(name, assetTab)}) center/cover, linear-gradient(135deg, #0f4, #053)`,
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
          <div
            style={{ ...resizerHitboxStyle, right: 6, bottom: 6 }}
            onMouseDown={onResizeStart}
            aria-hidden="true"
            title="拖曳調整資產抽屜高度"
          >
            <div style={resizerHandleStyle} />
          </div>
        </div>
      )}
    </div>
  );
}
