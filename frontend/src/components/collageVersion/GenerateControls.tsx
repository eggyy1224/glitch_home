import React from "react";

interface GenerateControlsProps {
  loading: boolean;
  generationDisabled: boolean;
  selectedCount: number;
  minRequired: number;
  progress: number;
  progressStage: string;
  progressMessage: string;
  onGenerate: () => void;
}

export function GenerateControls({
  loading,
  generationDisabled,
  selectedCount,
  minRequired,
  progress,
  progressStage,
  progressMessage,
  onGenerate,
}: GenerateControlsProps) {
  return (
    <div className="collage-version-section">
      <button
        type="button"
        onClick={onGenerate}
        disabled={generationDisabled || loading || selectedCount < minRequired}
        className="collage-version-generate"
      >
        {loading ? "生成中..." : generationDisabled ? "生成已停用" : "生成拼貼"}
      </button>

      {loading && (
        <div className="collage-version-progress">
          <div className="collage-version-progress-bar-container">
            <div
              className="collage-version-progress-bar"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="collage-version-progress-info">
            <span className="collage-version-progress-stage">
              {progressStage === "loading" && "載入中"}
              {progressStage === "standardizing" && "標準化"}
              {progressStage === "tiling" && "切片"}
              {progressStage === "matching" && "匹配"}
              {progressStage === "reassembling" && "重組"}
              {progressStage === "saving" && "儲存"}
              {progressStage === "completed" && "完成"}
              {progressStage === "failed" && "失敗"}
              {!progressStage && "準備中"}
            </span>
            <span className="collage-version-progress-percent">{progress}%</span>
          </div>
          {progressMessage && (
            <div style={{ fontSize: "11px", color: "#999", marginTop: "4px" }}>
              {progressMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
