import React from "react";
import "../styles/IframeTimelineControls.css";

export default function IframeTimelineControls({
  timelineId,
  timeline,
  currentStep,
  currentStepIndex,
  status,
  isPlaying,
  loading,
  error,
  onPlay,
  onPause,
  onStop,
  onNext,
  onPrevious,
  onReload,
}) {
  if (!timelineId) return null;

  const title = timeline?.title || timelineId;
  const stepCount = timeline?.step_count || (timeline?.steps?.length ?? 0);
  const loopLabel = timeline?.loop ? "循環播放" : "播放一次";
  const statusLabel =
    status === "loading"
      ? "載入中"
      : status === "playing"
        ? "播放中"
        : status === "error"
          ? "錯誤"
          : status === "paused"
            ? "暫停"
            : "待命";

  const currentLabel = currentStep?.label || currentStep?.snapshot;
  const durationLabel = currentStep?.duration ? `${currentStep.duration}s` : null;

  return (
    <div className="iframe-timeline-controls">
      <div className="timeline-header">
        <div className="timeline-titles">
          <div className="timeline-title">{title}</div>
          <div className="timeline-meta">
            #{timelineId} · {stepCount} 段 · {loopLabel}
          </div>
        </div>
        <div className={`timeline-status timeline-status-${status}`}>{statusLabel}</div>
      </div>
      <div className="timeline-actions">
        <button type="button" onClick={onPrevious} disabled={loading || status === "loading"}>
          ◀
        </button>
        {isPlaying ? (
          <button type="button" onClick={onPause} disabled={loading}>
            暫停
          </button>
        ) : (
          <button type="button" onClick={onPlay} disabled={loading || status === "error"}>
            播放
          </button>
        )}
        <button type="button" onClick={onStop} disabled={loading}>
          停止
        </button>
        <button type="button" onClick={onNext} disabled={loading || status === "loading"}>
          ▶
        </button>
        <button type="button" onClick={onReload} disabled={loading}>
          重新載入
        </button>
      </div>
      <div className="timeline-step-info">
        <div>
          <div className="step-label">
            第 {currentStepIndex + 1} 段 {currentLabel ? `· ${currentLabel}` : null}
          </div>
          <div className="step-meta">
            {durationLabel ? `維持 ${durationLabel}` : ""}
            {currentStep?.client_id ? ` · client=${currentStep.client_id}` : ""}
          </div>
        </div>
      </div>
      {error && <div className="timeline-error">{error}</div>}
    </div>
  );
}
