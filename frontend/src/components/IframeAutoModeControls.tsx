import React from "react";
import "../styles/IframeAutoModeControls.css";
import type { AutoRotationSnapshot, AutoRotationStatus } from "../hooks/useIframeAutoRotation";

interface IframeAutoModeControlsProps {
  enabled: boolean;
  status: AutoRotationStatus;
  statusText: string;
  error?: string | null;
  isPlaying: boolean;
  queue: AutoRotationSnapshot[];
  current: AutoRotationSnapshot | null;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onReload: () => void;
}

export default function IframeAutoModeControls({
  enabled,
  status,
  statusText,
  error,
  isPlaying,
  queue,
  current,
  onTogglePlay,
  onNext,
  onPrevious,
  onReload,
}: IframeAutoModeControlsProps) {
  if (!enabled) return null;

  const statusClass =
    status === "playing"
      ? "auto-mode-status-playing"
      : status === "loading"
        ? "auto-mode-status-loading"
        : status === "error"
          ? "auto-mode-status-error"
          : status === "paused"
            ? "auto-mode-status-paused"
            : "";

  const currentLabel = current ? `${current.clientId}/${current.name}` : "（尚未選擇）";
  const queueLabel = queue.length ? `${queue.length} 筆` : "0 筆";

  return (
    <div className="iframe-auto-mode-control-trigger">
      <div className="iframe-auto-mode-controls">
        <div className="auto-mode-header">
          <div className="auto-mode-titles">
            <div className="auto-mode-title">AUTO MODE</div>
            <div className="auto-mode-meta">snapshots: {queueLabel}</div>
          </div>
          <div className={`auto-mode-status ${statusClass}`}>{statusText}</div>
        </div>

        <div className="auto-mode-current">
          <div className="auto-mode-current-label">目前</div>
          <div className="auto-mode-current-value">{currentLabel}</div>
        </div>

        <div className="auto-mode-actions">
          <button type="button" onClick={onPrevious} disabled={status === "loading"}>
            ◀
          </button>
          <button type="button" onClick={onTogglePlay} disabled={status === "loading" || queue.length === 0}>
            {isPlaying ? "暫停" : "播放"}
          </button>
          <button type="button" onClick={onNext} disabled={status === "loading"}>
            ▶
          </button>
          <button type="button" onClick={onReload} disabled={status === "loading"}>
            重新載入
          </button>
        </div>

        {error ? <div className="auto-mode-error">{error}</div> : null}
      </div>
    </div>
  );
}
