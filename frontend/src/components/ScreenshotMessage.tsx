import React from "react";

interface ScreenshotMessageProps {
  message?: string | null;
}

export default function ScreenshotMessage({ message }: ScreenshotMessageProps) {
  if (!message) {
    return null;
  }

  return (
    <div className="screenshot-panel">
      <div className="screenshot-message">{message}</div>
    </div>
  );
}
