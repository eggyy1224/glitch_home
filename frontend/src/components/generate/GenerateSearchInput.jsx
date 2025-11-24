import React from "react";

export default function GenerateSearchInput({
  textQuery,
  onTextQueryChange,
  onTextSearch,
  onClear,
  searching,
  onKeyPress,
}) {
  return (
    <div className="generate-search">
      <div className="generate-search-text">
        <input
          type="text"
          value={textQuery}
          onChange={(e) => onTextQueryChange(e.target.value)}
          onKeyPress={onKeyPress}
          placeholder="輸入圖片名稱或關鍵字，例如：白馬、夜晚、人物"
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
    </div>
  );
}
