import type { MouseEventHandler } from "react";

type SearchResult = {
  id: string;
  distance?: number | null;
  [key: string]: unknown;
};

type SearchResultsGridProps = {
  results: SearchResult[];
  imagesBase: string;
  onResultClick: (id: string) => void;
};

export default function SearchResultsGrid({ results, imagesBase, onResultClick }: SearchResultsGridProps) {
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
          const similarity = Math.max(0, (1 - distance / 2) * 100).toFixed(0);

          const handleClick: MouseEventHandler<HTMLButtonElement> = () => {
            onResultClick(cleanId);
          };

          return (
            <button
              type="button"
              key={`${cleanId}-${index}`}
              className="search-mode__result-card"
              onClick={handleClick}
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
