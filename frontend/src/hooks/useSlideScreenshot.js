import { useEffect } from "react";
import { ensureHtml2Canvas } from "../utils/html2canvasLoader.js";
import { canvasToBlob } from "../utils/slideMode.js";

export function useSlideScreenshot({ rootRef, onCaptureReady, html2canvasLoader = ensureHtml2Canvas } = {}) {
  useEffect(() => {
    if (typeof onCaptureReady !== "function") {
      return undefined;
    }

    const captureScene = async () => {
      const root = rootRef?.current;
      if (!root) {
        throw new Error("Slide 模式尚未準備好");
      }

      const html2canvas = await html2canvasLoader();
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
  }, [rootRef, onCaptureReady, html2canvasLoader]);
}
