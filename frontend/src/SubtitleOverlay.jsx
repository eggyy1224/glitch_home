import React from "react";

export default function SubtitleOverlay({ subtitle = null }) {
  if (!subtitle || !subtitle.text) return null;
  const langAttr = subtitle.language ? subtitle.language : undefined;
  return (
    <div className="subtitle-container" role="status" aria-live="polite">
      <div className="subtitle-text" lang={langAttr}>
        {subtitle.text}
      </div>
    </div>
  );
}
