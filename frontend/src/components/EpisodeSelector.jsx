import React from "react";

export default function EpisodeSelector({
  episodes,
  selectedEpisodeId,
  loading,
  error,
  onSelect,
  onRefresh,
}) {
  const hasEpisodes = Array.isArray(episodes) && episodes.length > 0;
  const handleChange = (event) => {
    const value = event?.target?.value;
    onSelect?.(value || null);
  };

  return (
    <div className="badge episode-control">
      <div className="episode-control-row">
        <label htmlFor="episode-select">Episode</label>
        <select
          id="episode-select"
          value={selectedEpisodeId || ""}
          onChange={handleChange}
          disabled={!hasEpisodes || loading}
        >
          <option value="">（未選擇）</option>
          {episodes?.map((episode) => (
            <option key={episode.id} value={episode.id}>
              {episode.title || episode.id}
            </option>
          ))}
        </select>
        <button type="button" onClick={onRefresh} disabled={loading}>
          重新整理
        </button>
      </div>
      <div className={`episode-control-status${error ? " error" : ""}`}>
        {loading
          ? "載入中..."
          : error
            ? `錯誤：${error}`
            : hasEpisodes
              ? "已載入"
              : "無可用 Episode"}
      </div>
    </div>
  );
}
