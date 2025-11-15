import React from "react";

export default function SearchResultsGrid({ results, imagesBase, onResultClick }) {
  if (!results?.length) {
    return null;
  }

  return (
    <div className="search-mode__results">
      <h2>搜尋結果（{results.length} 張）</h2>
      <div className="search-mode__results-grid">
        {results.map((result, index) => {
          const cleanId = result.id.replace(/:(en|zh)$/, "");
          const imageUrl = `${imagesBase}${cleanId}`;
          const distance = result.distance ?? 0;
          const similarity = Math.max(0, ((1 - distance / 2) * 100)).toFixed(0);

          return (
            <button
              type="button"
              key={`${cleanId}-${index}`}
              className="search-mode__result-card"
              onClick={() => onResultClick(cleanId)}
            >
              <div className="search-mode__result-image-container">
                <img
                  src={imageUrl}
                  alt={cleanId}
                  className="search-mode__result-image"
                  onError={(event) => {
                    event.currentTarget.classList.add("is-missing");
                  }}
                />
                <div className="search-mode__distance-badge">距離: {distance.toFixed(3)}</div>
              </div>
              <div className="search-mode__result-info">
                <p className="search-mode__result-title">{cleanId}</p>
                <p className="search-mode__result-meta">相似度：{similarity}%</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
