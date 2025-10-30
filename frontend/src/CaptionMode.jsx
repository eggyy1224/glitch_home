import React from "react";
import "./CaptionMode.css";

export default function CaptionMode({ caption }) {
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
