import React from "react";
import "./CaptionMode.css";
import type { OverlayContent } from "./types/overlay";

export interface CaptionModeProps {
  caption?: OverlayContent | null;
}

export default function CaptionMode({ caption }: CaptionModeProps) {
  return (
    <div className="caption-mode-container">
      {caption && caption.text && (
        <div className="caption-mode-content">
          <h1 className="caption-mode-text">{caption.text}</h1>
        </div>
      )}
    </div>
  );
}
