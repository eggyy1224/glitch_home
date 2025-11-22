import React from "react";

export default function GenerateResultsList({
  displayMode,
  searchResultsLength,
  onDisplayAll,
  loadingImages,
  images,
  selectedImages,
  onToggleImage,
  onClearSelection,
  resolveImageUrl,
}) {
  return (
    <>
      {displayMode === "search" && (
        <div className="generate-display-mode">
          <span className="generate-display-mode-label">顯示：搜尋結果 ({searchResultsLength} 張)</span>
          <button type="button" onClick={onDisplayAll} className="generate-display-mode-btn">
            返回全部
          </button>
        </div>
      )}

      {loadingImages ? (
        <div className="generate-loading">
          <div className="generate-spinner"></div>
          <p>載入圖片列表中...</p>
        </div>
      ) : (
        <>
          <div className="generate-image-grid">
            {images.map((image) => {
              const isSelected = selectedImages.includes(image.filename);
              const imageSrc = resolveImageUrl(image);
              return (
                <div
                  key={image.filename}
                  className={`generate-image-item ${isSelected ? "selected" : ""}`}
                  onClick={() => onToggleImage(image.filename)}
                >
                  <img src={imageSrc} alt={image.filename} />
                  <div className="generate-image-overlay">{isSelected && <span className="generate-check">✓</span>}</div>
                  <div className="generate-image-name">{image.filename}</div>
                </div>
              );
            })}
          </div>
          {selectedImages.length > 0 && (
            <div className="generate-selected-count">
              <span>已選擇 {selectedImages.length} 張圖片</span>
              <button type="button" onClick={onClearSelection} className="generate-clear-selection">
                清除選擇
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
