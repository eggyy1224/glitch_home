import React from "react";

interface SubtitleCaptionStatusProps {
  subtitle?: string | null | undefined;
  caption?: string | null | undefined;
}

export default function SubtitleCaptionStatus({ subtitle, caption }: SubtitleCaptionStatusProps) {
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
