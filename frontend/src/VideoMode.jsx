import React, { useEffect, useMemo, useRef } from "react";
import { ensureHtml2Canvas } from "./utils/html2canvasLoader.js";
import "./VideoMode.css";

const canvasToBlob = (canvas) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("無法產生截圖"));
          return;
        }
        resolve(blob);
      },
      "image/png",
    );
  });

export default function VideoMode({ onCaptureReady = null }) {
  const rootRef = useRef(null);

  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const videoFileName = params.get("video");

  const videoUrl = videoFileName ? `/videos/圖像系譜學Video/${videoFileName}` : null;

  useEffect(() => {
    if (typeof onCaptureReady !== "function") {
      return undefined;
    }

    const captureScene = async () => {
      const root = rootRef.current;
      if (!root) {
        throw new Error("Video 模式尚未準備好");
      }
      const html2canvas = await ensureHtml2Canvas();
      const canvas = await html2canvas(root, {
        backgroundColor: "#000000",
        logging: false,
        useCORS: true,
      });
      return canvasToBlob(canvas);
    };

    onCaptureReady(captureScene);
    return () => {
      onCaptureReady(null);
    };
  }, [onCaptureReady]);

  return (
    <div ref={rootRef} className="video-mode-container">
      {videoUrl ? (
        <video
          src={videoUrl}
          className="video-mode-video"
          controls
          autoPlay
          muted
          loop
          playsInline
        />
      ) : (
        <div className="video-mode-placeholder">請在網址加上 ?video=檔名.mp4</div>
      )}
    </div>
  );
}
