import React from "react";

export default function SubtitleCaptionStatus({ subtitle, caption }) {
  if (!subtitle && !caption) {
    return null;
  }

  return (
    <div className="badge subtitle-caption-status">
      {subtitle && <div>字幕：{subtitle}</div>}
      {caption && <div>標題：{caption}</div>}
    </div>
  );
}
