import { useCallback, useEffect, useRef } from "react";
import { ensureHtml2Canvas } from "../utils/html2canvasLoader";
import { COLLAGE_PIECE_OVERLAP_PX as PIECE_OVERLAP_PX } from "../constants/collage";

type CaptureReadyHandler = ((capture: (() => Promise<Blob>) | null) => void) | null | undefined;

export function useCollageCapture(onCaptureReady?: CaptureReadyHandler) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const html2canvasPromiseRef = useRef<ReturnType<typeof ensureHtml2Canvas> | null>(null);

  const ensureHtml2canvasReady = useCallback(() => {
    if (!html2canvasPromiseRef.current) {
      html2canvasPromiseRef.current = ensureHtml2Canvas();
    }
    return html2canvasPromiseRef.current;
  }, []);

  useEffect(() => {
    ensureHtml2canvasReady();
  }, [ensureHtml2canvasReady]);

  useEffect(() => {
    if (onCaptureReady == null) return undefined;

    const captureScene = async () => {
      const root = rootRef.current;
      if (!root) {
        throw new Error("Collage 模式尚未準備好");
      }

      const html2canvas = await ensureHtml2canvasReady();

      const maxWaitTime = 3000;
      const checkInterval = 100;
      let waited = 0;
      let piecesElements = root.querySelectorAll<HTMLElement>(".collage-piece");

      while (piecesElements.length === 0 && waited < maxWaitTime) {
        await new Promise((resolve) => setTimeout(resolve, checkInterval));
        waited += checkInterval;
        piecesElements = root.querySelectorAll(".collage-piece");
      }

      if (piecesElements.length === 0) {
        const isLoading = root.querySelector(".collage-status")?.textContent?.includes("載入中");
        const hasError = root.querySelector(".collage-status-error");
        const noImages = root.querySelector(".collage-status")?.textContent?.includes("沒有圖像");

        if (isLoading) {
          throw new Error("Collage 仍在載入中，請稍後再試");
        }
        if (hasError) {
          throw new Error(`Collage 載入錯誤: ${hasError.textContent}`);
        }
        if (noImages) {
          throw new Error("Collage 沒有可用的圖像");
        }
        throw new Error(`Collage 碎片尚未渲染完成（等待 ${waited}ms 後仍無碎片），請稍後再試`);
      }

      let loadedCount = 0;
      piecesElements.forEach((el: HTMLElement) => {
        const bgImage = window.getComputedStyle(el).backgroundImage;
        if (bgImage && bgImage !== "none" && !bgImage.includes("data:")) {
          loadedCount += 1;
        }
      });

      if (loadedCount === 0) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        piecesElements = root.querySelectorAll<HTMLElement>(".collage-piece");
        loadedCount = 0;
        piecesElements.forEach((el: HTMLElement) => {
          const bgImage = window.getComputedStyle(el).backgroundImage;
          if (bgImage && bgImage !== "none" && !bgImage.includes("data:")) {
            loadedCount += 1;
          }
        });
      }

      const mixSurface = root.querySelector<HTMLElement>(".collage-mix-surface");
      const tiles = root.querySelectorAll(".collage-tile");
      let targetElement: HTMLElement = root;
      let rootWidth = root.clientWidth;
      let rootHeight = root.clientHeight;
      const rootRect = root.getBoundingClientRect();
      if (mixSurface) {
        const mixRect = mixSurface.getBoundingClientRect();
        const margin = PIECE_OVERLAP_PX * 2;
        const mixWidth = mixSurface.scrollWidth || mixRect.width;
        const mixHeight = mixSurface.scrollHeight || mixRect.height;
        if (mixWidth > 0 && mixHeight > 0) {
          rootWidth = mixWidth + margin * 2;
          rootHeight = mixHeight + margin * 2;
          targetElement = mixSurface;
        } else {
          rootWidth = mixRect.width + margin * 2;
          rootHeight = mixRect.height + margin * 2;
          targetElement = mixSurface;
        }
      } else if (tiles.length > 0) {
        const scrollWidth = root.scrollWidth;
        const scrollHeight = root.scrollHeight;
        if (scrollWidth > 0 && scrollHeight > 0) {
          rootWidth = scrollWidth;
          rootHeight = scrollHeight;
        }
      }

      if (rootWidth <= 0 || rootHeight <= 0 || !Number.isFinite(rootWidth) || !Number.isFinite(rootHeight)) {
        rootWidth = rootRect.width || 1920;
        rootHeight = rootRect.height || 1080;
      }

      const pieceCount = piecesElements.length;
      const canvasArea = rootWidth * rootHeight;
      let scale = 1;
      let timeout = 30000;
      if (canvasArea > 8000000) {
        scale = 0.3;
        timeout = 120000;
      } else if (canvasArea > 5000000) {
        scale = 0.4;
        timeout = 90000;
      } else if (canvasArea > 3000000) {
        scale = 0.5;
        timeout = 60000;
      } else if (canvasArea > 2000000) {
        scale = 0.6;
        timeout = 45000;
      }

      if (pieceCount > 2000) {
        scale = Math.min(scale, 0.7);
        timeout = Math.max(timeout, 60000);
      }
      if (pieceCount > 3000) {
        scale = Math.min(scale, 0.5);
        timeout = Math.max(timeout, 90000);
      }
      if (pieceCount > 5000) {
        scale = Math.min(scale, 0.4);
        timeout = Math.max(timeout, 120000);
      }

      const maxCanvasSize = 16384;
      const scaledWidth = rootWidth * scale;
      const scaledHeight = rootHeight * scale;

      if (scaledWidth > maxCanvasSize || scaledHeight > maxCanvasSize) {
        const widthScale = maxCanvasSize / rootWidth;
        const heightScale = maxCanvasSize / rootHeight;
        scale = Math.min(scale, widthScale, heightScale) * 0.95;
      }

      console.log(`[CollageMode] 截圖尺寸: ${rootWidth}×${rootHeight} (scale: ${scale})`);

      const canvas = await html2canvas(
        targetElement,
        {
          backgroundColor: "#050508",
          logging: false,
          useCORS: true,
          allowTaint: false,
          scale,
          // timeout 非官方型別，轉型以符合實際呼叫參數
          timeout,
          removeContainer: false,
          foreignObjectRendering: false,
          onclone: (doc: Document) => {
            doc.querySelectorAll<HTMLElement>(".collage-piece").forEach((el) => {
              el.style.animation = "none";
              el.style.opacity = "1";
              el.style.transform = "none";
              el.style.visibility = "visible";
              el.style.display = "";
            });
            const clonedMixSurface = doc.querySelector<HTMLElement>(".collage-mix-surface");
            if (clonedMixSurface) {
              clonedMixSurface.style.overflow = "visible";
              clonedMixSurface.style.position = "relative";
              clonedMixSurface.style.width = `${rootWidth}px`;
              clonedMixSurface.style.height = `${rootHeight}px`;
              clonedMixSurface.style.maxWidth = "none";
              clonedMixSurface.style.maxHeight = "none";
            }
          },
        } as any,
      );
      return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("無法產生拼貼截圖"));
            return;
          }
          resolve(blob);
        }, "image/png");
      });
    };

    onCaptureReady(captureScene);
    return () => {
      onCaptureReady(null);
    };
  }, [onCaptureReady, ensureHtml2canvasReady]);

  return { rootRef };
}
