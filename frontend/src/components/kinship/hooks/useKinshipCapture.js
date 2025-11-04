import { useCallback, useEffect, useRef } from "react";

export function useKinshipCapture(onCaptureReady) {
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);

  const captureScreenshot = useCallback(() => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!renderer || !scene || !camera) {
      return Promise.reject(new Error("renderer not ready"));
    }

    return new Promise((resolve, reject) => {
      try {
        renderer.render(scene, camera);
        renderer.domElement.toBlob(
          (blob) => {
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

  const handleCreated = useCallback(({ gl, scene, camera }) => {
    rendererRef.current = gl;
    sceneRef.current = scene;
    cameraRef.current = camera;
    gl.preserveDrawingBuffer = true;
  }, []);

  return { handleCreated };
}
