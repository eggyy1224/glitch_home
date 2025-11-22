import React from "react";

export default function GenerateSearchInput({
  searchType,
  onSearchTypeChange,
  textQuery,
  onTextQueryChange,
  onTextSearch,
  searchFile,
  searchPreview,
  onFileSelect,
  onImageSearch,
  onClear,
  searching,
  fileInputRef,
  onKeyPress,
}) {
  return (
    <div className="generate-search">
      <div className="generate-search-mode">
        <button
          type="button"
          className={`generate-search-mode-btn ${searchType === "text" ? "active" : ""}`}
          onClick={() => onSearchTypeChange("text")}
        >
          📝 文字搜尋
        </button>
        <button
          type="button"
          className={`generate-search-mode-btn ${searchType === "image" ? "active" : ""}`}
          onClick={() => onSearchTypeChange("image")}
        >
          📸 圖片搜尋
        </button>
      </div>

      {searchType === "text" ? (
        <div className="generate-search-text">
          <input
            type="text"
            value={textQuery}
            onChange={(e) => onTextQueryChange(e.target.value)}
            onKeyPress={onKeyPress}
            placeholder="輸入搜尋詞... 例如：白馬、夜晚、人物"
            className="generate-search-input"
          />
          <div className="generate-search-controls">
            <button
              type="button"
              onClick={onTextSearch}
              disabled={!textQuery.trim() || searching}
              className="generate-search-btn"
            >
              {searching ? "搜尋中..." : "搜尋"}
            </button>
            {textQuery && (
              <button
                type="button"
                onClick={onClear}
                disabled={searching}
                className="generate-search-clear"
              >
                清除
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="generate-search-image">
          {searchPreview ? (
            <div className="generate-search-preview">
              <img src={searchPreview} alt="預覽" />
              <p>{searchFile.name}</p>
            </div>
          ) : (
            <div className="generate-search-upload" onClick={() => fileInputRef.current?.click()}>
              <div className="generate-search-upload-icon">📸</div>
              <p>點擊上傳圖片或拖放</p>
              <p className="generate-search-upload-hint">支援 PNG, JPG, JPEG</p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            onChange={(e) => onFileSelect(e.target.files?.[0])}
            style={{ display: "none" }}
          />
          <div className="generate-search-controls">
            <button
              type="button"
              onClick={onImageSearch}
              disabled={!searchFile || searching}
              className="generate-search-btn"
            >
              {searching ? "搜尋中..." : "搜尋"}
            </button>
            {searchFile && (
              <button
                type="button"
                onClick={onClear}
                disabled={searching}
                className="generate-search-clear"
              >
                清除
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
