import React from "react";
import type { OffspringImageInfo } from "../../hooks/useCollageVersionImages";

interface ImageSelectorProps {
  minRequired: number;
  textQuery: string;
  setTextQuery: (value: string) => void;
  searching: boolean;
  displayMode: "all" | "search";
  searchResultsCount: number;
  displayImages: OffspringImageInfo[];
  selectedImages: string[];
  loadingImages: boolean;
  imagesBase: string;
  onSearch: () => void | Promise<void>;
  onSearchClear: () => void;
  onKeyPress: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onToggleDisplayMode: () => void;
  onToggleImage: (filename: string) => void;
  onClearSelection: () => void;
}

export function ImageSelector({
  minRequired,
  textQuery,
  setTextQuery,
  searching,
  displayMode,
  searchResultsCount,
  displayImages,
  selectedImages,
  loadingImages,
  imagesBase,
  onSearch,
  onSearchClear,
  onKeyPress,
  onToggleDisplayMode,
  onToggleImage,
  onClearSelection,
}: ImageSelectorProps) {
  return (
    <div className="collage-version-section">
      <h3>圖片選擇（至少 {minRequired} 張）</h3>

      <div className="collage-version-search">
        <div className="collage-version-search-text">
          <input
            type="text"
            value={textQuery}
            onChange={(e) => setTextQuery(e.target.value)}
            onKeyPress={onKeyPress}
            placeholder="輸入圖片名稱或關鍵字，例如：白馬、夜晚、人物"
            className="collage-version-search-input"
          />
          <div className="collage-version-search-controls">
            <button
              type="button"
              onClick={onSearch}
              disabled={!textQuery.trim() || searching}
              className="collage-version-search-btn"
            >
              {searching ? "搜尋中..." : "搜尋"}
            </button>
            {textQuery && (
              <button
                type="button"
                onClick={onSearchClear}
                disabled={searching}
                className="collage-version-search-clear"
              >
                清除
              </button>
            )}
          </div>
        </div>
      </div>

      {displayMode === "search" && (
        <div className="collage-version-display-mode">
          <span className="collage-version-display-mode-label">顯示：搜尋結果 ({searchResultsCount} 張)</span>
          <button
            type="button"
            onClick={onToggleDisplayMode}
            className="collage-version-display-mode-btn"
          >
            返回全部
          </button>
        </div>
      )}

      <div className="collage-version-selected-count">
        <div className="collage-version-selected-details">
          <span className="collage-version-selected-label">已選擇 {selectedImages.length} 張圖片</span>
          <span className="collage-version-selected-hint">至少需要 {minRequired} 張，清除後可重新挑選</span>
        </div>
        <button
          type="button"
          onClick={onClearSelection}
          className="collage-version-clear-selection"
          disabled={selectedImages.length === 0}
        >
          清除選擇
        </button>
      </div>

      {loadingImages ? (
        <div className="collage-version-loading">
          <div className="collage-version-spinner"></div>
          <p>載入圖片列表中...</p>
        </div>
      ) : (
        <div className="collage-version-image-grid">
          {displayImages.map((image) => {
            const isSelected = selectedImages.includes(image.filename);
            return (
              <div
                key={image.filename}
                className={`collage-version-image-item ${isSelected ? "selected" : ""}`}
                onClick={() => onToggleImage(image.filename)}
              >
                <img src={image.url || `${imagesBase}${image.filename}`} alt={image.filename} />
                <div className="collage-version-image-overlay">
                  {isSelected && <span className="collage-version-check">✓</span>}
                </div>
                <div className="collage-version-image-name">{image.filename}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
