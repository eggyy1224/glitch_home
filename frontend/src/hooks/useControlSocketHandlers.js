import { useCallback } from "react";

export function useControlSocketHandlers({
  clientId,
  applySubtitle,
  applyCaption,
  applyRemoteIframeConfig,
  applyRemoteCollageConfig,
  markRequestDone,
  unlockAudioElementRef,
  videoControllerRef,
}) {
  const handleScreenshotLifecycle = useCallback(
    (payload) => {
      if (payload?.request_id) {
        markRequestDone(payload.request_id);
      }
    },
    [markRequestDone],
  );

  const handleSubtitleMessage = useCallback(
    (payload) => {
      const targetId = payload?.target_client_id;
      if (targetId && targetId !== clientId) {
        return;
      }
      applySubtitle(payload?.subtitle ?? null);
    },
    [clientId, applySubtitle],
  );

  const handleCaptionMessage = useCallback(
    (payload) => {
      const targetId = payload?.target_client_id;
      if (targetId && targetId !== clientId) {
        return;
      }
      applyCaption(payload?.caption ?? null);
    },
    [clientId, applyCaption],
  );

  const handleIframeConfigMessage = useCallback(
    (payload) => {
      if (!payload?.config) return;
      const targetId = payload?.target_client_id;
      if (targetId && targetId !== clientId) {
        return;
      }
      applyRemoteIframeConfig(payload.config);
    },
    [clientId, applyRemoteIframeConfig],
  );

  const handleCollageConfigMessage = useCallback(
    (payload) => {
      if (!payload?.config) return;
      const targetId = payload?.target_client_id;
      if (targetId && targetId !== clientId) {
        return;
      }
      applyRemoteCollageConfig(payload);
    },
    [clientId, applyRemoteCollageConfig],
  );

  const handleUnlockAudioMessage = useCallback(
    (payload) => {
      const targetId = payload?.target_client_id;
      if (targetId && targetId !== clientId) {
        return;
      }
      const body = document.body;
      const fallbackClick = () => {
        if (!body) return;
        try {
          const clickEvent = new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            view: window,
          });
          body.dispatchEvent(clickEvent);
        } catch (err) {
          // ignore dispatch error and fallback to direct click below
        }
        if (typeof body?.click === "function") {
          body.click();
        }
      };

      try {
        const audio = unlockAudioElementRef.current;
        if (!audio) {
          fallbackClick();
          return;
        }
        try {
          audio.currentTime = 0;
        } catch (err) {
          // ignore seek errors
        }
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.then === "function") {
          playPromise
            .then(() => {
              audio.pause();
            })
            .catch(() => {
              fallbackClick();
            });
        } else {
          fallbackClick();
        }
      } catch (err) {
        fallbackClick();
      }
    },
    [clientId, unlockAudioElementRef],
  );

  const handleRemoteClickMessage = useCallback(
    (payload) => {
      const targetId = payload?.target_client_id;
      if (targetId && targetId !== clientId) {
        return;
      }
      const fallbackSelector = ".video-mode-container";
      const selector =
        typeof payload?.selector === "string" && payload.selector.trim().length > 0
          ? payload.selector.trim()
          : null;
      const childSelector =
        (typeof payload?.target_selector === "string" && payload.target_selector.trim().length > 0
          ? payload.target_selector.trim()
          : null) ||
        (typeof payload?.target === "string" && payload.target.trim().length > 0
          ? payload.target.trim()
          : null);
      const selectorsProvided = Boolean(selector || childSelector);

      let targetNode = null;
      let rootNode = null;
      if (selector) {
        rootNode = document.querySelector(selector);
      }
      if (rootNode && childSelector) {
        targetNode = rootNode.querySelector(childSelector) || rootNode;
      } else if (rootNode) {
        targetNode = rootNode;
      } else if (childSelector) {
        targetNode = document.querySelector(childSelector);
      }

      if (!targetNode && typeof payload?.x === "number" && typeof payload?.y === "number") {
        targetNode = document.elementFromPoint(payload.x, payload.y);
      }

      if (!targetNode && selectorsProvided && fallbackSelector) {
        targetNode = document.querySelector(fallbackSelector);
      }

      if (!targetNode) {
        return;
      }

      try {
        const clickEvent = new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window,
        });
        targetNode.dispatchEvent(clickEvent);
      } catch (err) {
        // ignore dispatch failure
      }
      if (typeof targetNode.click === "function") {
        targetNode.click();
      }
    },
    [clientId],
  );

  const handleVideoControlMessage = useCallback(
    (payload) => {
      const targetId = payload?.target_client_id;
      if (targetId && targetId !== clientId) {
        return;
      }
      const controller = videoControllerRef.current;
      if (!controller || typeof payload !== "object" || !payload) {
        return;
      }
      const action = typeof payload.action === "string" ? payload.action.trim().toLowerCase() : "";
      if (!action) {
        return;
      }
      if (action === "play") {
        controller.play?.();
        return;
      }
      if (action === "pause") {
        controller.pause?.();
        return;
      }
      if (action === "seek" && payload.time != null) {
        controller.seek?.(payload.time);
        return;
      }
      if (action === "set_volume" || action === "volume") {
        controller.setVolume?.(payload.volume);
        return;
      }
      if (action === "set_muted") {
        controller.setMuted?.(payload.muted);
        return;
      }
      if (action === "mute") {
        controller.setMuted?.(true);
        return;
      }
      if (action === "unmute") {
        controller.setMuted?.(false);
        if (payload.volume != null) {
          controller.setVolume?.(payload.volume);
        }
      }
    },
    [clientId, videoControllerRef],
  );

  return {
    handleScreenshotLifecycle,
    handleSubtitleMessage,
    handleCaptionMessage,
    handleIframeConfigMessage,
    handleCollageConfigMessage,
    handleUnlockAudioMessage,
    handleRemoteClickMessage,
    handleVideoControlMessage,
  };
}
