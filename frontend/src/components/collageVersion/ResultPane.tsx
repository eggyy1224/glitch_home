import React from "react";
import type { CollageGenerationResult } from "../../hooks/useCollageVersionGeneration";

interface ResultPaneProps {
  loading: boolean;
  result: CollageGenerationResult | null;
}

export function ResultPane({ loading, result }: ResultPaneProps) {
  return (
    <div className="collage-version-column collage-version-result-pane">
      <h3>結果</h3>
      {loading && (
        <div className="collage-version-loading">
          <div className="collage-version-spinner"></div>
          <p>正在生成拼貼...</p>
        </div>
      )}
      {result && (
        <div className="collage-version-result">
          <img src={result.imageUrl} alt="Generated Collage" />
          <div className="collage-version-result-info">
            <p>檔名: {result.output_image}</p>
            <p>尺寸: {result.width} × {result.height}</p>
            <p>格式: {result.output_format}</p>
            <p>親代圖: {result.parents?.join(", ")}</p>
          </div>
        </div>
      )}
      {!loading && !result && (
        <div className="collage-version-placeholder">
          <p>生成結果將顯示在這裡</p>
        </div>
      )}
    </div>
  );
}
