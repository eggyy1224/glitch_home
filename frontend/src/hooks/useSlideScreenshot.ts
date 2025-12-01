import { useEffect } from "react";
import type React from "react";
import { ensureHtml2Canvas } from "../utils/html2canvasLoader";
import { canvasToBlob } from "../utils/slideMode";

interface UseSlideScreenshotOptions {
  rootRef?: React.RefObject<HTMLElement>;
  onCaptureReady?: ((capture: (() => Promise<Blob>) | null) => void) | undefined;
  html2canvasLoader?: () => Promise<typeof import("html2canvas").default>;
}

export function useSlideScreenshot({
  rootRef,
  onCaptureReady,
  html2canvasLoader = ensureHtml2Canvas,
}: UseSlideScreenshotOptions = {}) {
  useEffect(() => {
    if (typeof onCaptureReady !== "function") {
      return undefined;
    }

    const captureScene = async (): Promise<Blob> => {
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
      return canvasToBlob(canvas) as Promise<Blob>;
    };

    onCaptureReady(captureScene);
    return () => {
      onCaptureReady(null);
    };
  }, [rootRef, onCaptureReady, html2canvasLoader]);
}
