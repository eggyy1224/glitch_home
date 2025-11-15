import React from "react";

export default function ScreenshotMessage({ message }) {
  if (!message) {
    return null;
  }

  return (
    <div className="screenshot-panel">
      <div className="screenshot-message">{message}</div>
    </div>
  );
}
