import React from "react";
import type { OverlayContent } from "./types/overlay";

export interface SubtitleOverlayProps {
  subtitle?: OverlayContent | null;
}

export default function SubtitleOverlay({ subtitle = null }: SubtitleOverlayProps) {
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
