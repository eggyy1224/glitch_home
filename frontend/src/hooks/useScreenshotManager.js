import { useCallback, useEffect, useRef, useState } from "react";
import { reportScreenshotFailure, uploadScreenshot } from "../api.js";

export function useScreenshotManager(clientId) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [screenshotMessage, setScreenshotMessage] = useState(null);

  const captureFnRef = useRef(null);
  const requestQueueRef = useRef([]);
  const pendingRequestIdsRef = useRef(new Set());
  const isProcessingRef = useRef(false);
  const isCapturingRef = useRef(false);
  const queueTimerRef = useRef(null);
  const screenshotTimerRef = useRef(null);
  const isMountedRef = useRef(true);

  const clearScreenshotTimer = useCallback(() => {
    if (screenshotTimerRef.current) {
      clearTimeout(screenshotTimerRef.current);
      screenshotTimerRef.current = null;
    }
  }, []);

  const clearQueueTimer = useCallback(() => {
    if (queueTimerRef.current) {
      clearTimeout(queueTimerRef.current);
      queueTimerRef.current = null;
    }
  }, []);

  const pushScreenshotMessage = useCallback((text, ttl = 2500) => {
    setScreenshotMessage(text);
    clearScreenshotTimer();
    screenshotTimerRef.current = setTimeout(() => {
      setScreenshotMessage(null);
      screenshotTimerRef.current = null;
    }, ttl);
  }, [clearScreenshotTimer]);

  const runCaptureInternal = useCallback(
    async (requestId = null, isAuto = false) => {
      const captureFn = captureFnRef.current;
      if (!captureFn) {
        throw new Error("場景尚未準備好");
      }
      const blob = await captureFn();
      const result = await uploadScreenshot(blob, requestId, clientId);
      const label =
        result?.relative_path || result?.filename || (requestId ? `request ${requestId}` : "已上傳");
      const prefix = isAuto ? "自動截圖完成" : "截圖完成";
      pushScreenshotMessage(`${prefix}：${label}`);
      return result;
    },
    [pushScreenshotMessage, clientId],
  );

  const processQueue = useCallback(() => {
    if (!isMountedRef.current) return;
    if (isProcessingRef.current) return;

    const next = requestQueueRef.current.shift();
    if (!next) return;

    if (isCapturingRef.current) {
      requestQueueRef.current.unshift(next);
      if (!queueTimerRef.current) {
        queueTimerRef.current = setTimeout(() => {
          queueTimerRef.current = null;
          processQueue();
        }, 400);
      }
      return;
    }

    isProcessingRef.current = true;
    clearQueueTimer();
    isCapturingRef.current = true;
    if (isMountedRef.current) {
      setIsCapturing(true);
    }

    const request = next;
    (async () => {
      try {
        await runCaptureInternal(request.request_id, true);
      } catch (err) {
        const message = err?.message || String(err);
        pushScreenshotMessage(`自動截圖失敗：${message}`);
        if (request.request_id) {
          try {
            await reportScreenshotFailure(request.request_id, message, clientId);
          } catch (reportErr) {
            console.error("回報截圖失敗錯誤", reportErr);
          }
        }
      } finally {
        pendingRequestIdsRef.current.delete(request.request_id);
        isCapturingRef.current = false;
        if (isMountedRef.current) {
          setIsCapturing(false);
        }
        isProcessingRef.current = false;
        if (isMountedRef.current) {
          processQueue();
        }
      }
    })();
  }, [clientId, pushScreenshotMessage, runCaptureInternal, clearQueueTimer]);

  const enqueueScreenshotRequest = useCallback(
    (payload) => {
      if (!payload || !payload.request_id) return;
      const targetClientId = payload?.target_client_id ?? payload?.metadata?.client_id ?? null;
      if (targetClientId && targetClientId !== clientId) {
        return;
      }

      if (window.self !== window.top) {
        try {
          const parentUrl = window.parent.location.href;
          const parentParams = new URL(parentUrl).searchParams;
          const parentIframeMode = parentParams.get("iframe_mode") === "true";
          if (parentIframeMode) {
            return;
          }
        } catch (err) {
          // ignore cross origin errors
        }
      }

      const id = payload.request_id;
      if (pendingRequestIdsRef.current.has(id)) return;
      pendingRequestIdsRef.current.add(id);
      requestQueueRef.current.push(payload);
      const label = payload?.metadata?.label || payload?.metadata?.source || id;
      pushScreenshotMessage(`收到截圖請求：${label}`);
      processQueue();
    },
    [clientId, processQueue, pushScreenshotMessage],
  );

  const handleCaptureReady = useCallback(
    (fn) => {
      captureFnRef.current = fn;
      if (fn) {
        processQueue();
      }
    },
    [processQueue],
  );

  const markRequestDone = useCallback((requestId) => {
    if (!requestId) return;
    pendingRequestIdsRef.current.delete(requestId);
  }, []);

  const requestCapture = useCallback(() => runCaptureInternal(null, false), [runCaptureInternal]);

  useEffect(() => {
    isCapturingRef.current = isCapturing;
  }, [isCapturing]);

  useEffect(() => {
    const captureScene = async () => {
      const captureFn = captureFnRef.current;
      if (!captureFn) {
        throw new Error("場景尚未準備好");
      }
      return captureFn();
    };
    window.__APP_CAPTURE_SCENE = captureScene;
    return () => {
      if (window.__APP_CAPTURE_SCENE === captureScene) {
        delete window.__APP_CAPTURE_SCENE;
      }
    };
  }, []);

  useEffect(() => () => {
    isMountedRef.current = false;
    clearQueueTimer();
    clearScreenshotTimer();
    if (captureFnRef.current) {
      captureFnRef.current = null;
    }
  }, [clearQueueTimer, clearScreenshotTimer]);

  return {
    isCapturing,
    screenshotMessage,
    handleCaptureReady,
    enqueueScreenshotRequest,
    markRequestDone,
    requestCapture,
  };
}
