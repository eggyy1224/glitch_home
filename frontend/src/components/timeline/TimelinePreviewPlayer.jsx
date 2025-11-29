import React from "react";
import { previewContainerStyle, previewTitleStyle, timelinePreviewIframeStyle } from "../../AdminPanelStyles";

export default function TimelinePreviewPlayer({
  previewSrc,
  previewError,
  playSrc,
  playError,
}) {
  return (
    <div style={previewContainerStyle} data-ai-section="timeline.preview" data-ai-role="timeline.preview">
      <div style={previewTitleStyle} data-ai-section="timeline.preview.first" data-ai-role="timeline.preview.first-title">
        首段 snapshot 預覽
      </div>
      {previewSrc ? (
        <iframe
          title="timeline-first-preview"
          src={previewSrc}
          style={{ ...timelinePreviewIframeStyle, minHeight: 260 }}
          sandbox="allow-scripts allow-same-origin"
          data-ai-id="timeline.preview.first-iframe"
          data-ai-role="timeline.preview.first-iframe"
        />
      ) : (
        <div style={{ color: "#82dca5" }} data-ai-status="timeline.preview.first-empty" data-ai-role="timeline.preview.first-empty">
          {previewError || "無法產生預覽"}
        </div>
      )}
      <div style={{ ...previewTitleStyle, marginTop: 10 }} data-ai-role="timeline.preview.full-title">
        整段播放預覽
      </div>
      {playSrc ? (
        <iframe
          key={playSrc}
          title="timeline-full-preview"
          src={playSrc}
          style={{ ...timelinePreviewIframeStyle, minHeight: 260 }}
          sandbox="allow-scripts allow-same-origin"
          data-ai-id="timeline.preview.full-iframe"
          data-ai-role="timeline.preview.full-iframe"
        />
      ) : (
        <div style={{ color: "#82dca5" }} data-ai-status="timeline.preview.full-empty" data-ai-role="timeline.preview.full-empty">
          {playError || "點擊「以 iframe 預覽」後顯示"}
        </div>
      )}
    </div>
  );
}
