import { useCallback, useEffect, useRef } from "react";
import type { Camera, Scene, WebGLRenderer } from "three";

type CaptureReadyHandler = ((capture: (() => Promise<Blob>) | null) => void) | null | undefined;

export function useKinshipCapture(onCaptureReady: CaptureReadyHandler) {
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const cameraRef = useRef<Camera | null>(null);

  const captureScreenshot = useCallback(() => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!renderer || !scene || !camera) {
      return Promise.reject(new Error("renderer not ready"));
    }

    return new Promise<Blob>((resolve, reject) => {
      try {
        renderer.render(scene, camera);
        renderer.domElement.toBlob(
          (blob: Blob | null) => {
            if (!blob) {
              reject(new Error("無法產生截圖"));
              return;
            }
            resolve(blob);
          },
          "image/png",
        );
      } catch (err) {
        reject(err);
      }
    });
  }, []);

  useEffect(() => {
    if (typeof onCaptureReady !== "function") return undefined;
    onCaptureReady(captureScreenshot);
    return () => onCaptureReady(null);
  }, [captureScreenshot, onCaptureReady]);

  const handleCreated = useCallback(({ gl, scene, camera }: { gl: WebGLRenderer; scene: Scene; camera: Camera }) => {
    rendererRef.current = gl;
    sceneRef.current = scene;
    cameraRef.current = camera;
    (gl as WebGLRenderer & { preserveDrawingBuffer?: boolean }).preserveDrawingBuffer = true;
  }, []);

  return { handleCreated };
}
