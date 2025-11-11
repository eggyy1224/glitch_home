import React, { useEffect, useMemo, useRef } from "react";
import { ensureHtml2Canvas } from "./utils/html2canvasLoader.js";
import "./StaticMode.css";

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

export default function StaticMode({ imagesBase, imgId, onCaptureReady = null }) {
  const rootRef = useRef(null);

  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const objectFit = params.get("object_fit") || "contain";
  const objectPosition = params.get("object_position") || "center";

  const imageUrl = imgId ? `${imagesBase}${imgId}` : null;

  useEffect(() => {
    if (typeof onCaptureReady !== "function") {
      return undefined;
    }

    const captureScene = async () => {
      const root = rootRef.current;
      if (!root) {
        throw new Error("Static 模式尚未準備好");
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
    <div ref={rootRef} className="static-mode-container">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={imgId}
          className="static-mode-image"
          style={{
            objectFit: objectFit,
            objectPosition: objectPosition,
          }}
        />
      ) : (
        <div className="static-mode-placeholder">請在網址加上 ?img=檔名</div>
      )}
    </div>
  );
}

