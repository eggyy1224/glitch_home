import { useCallback, useMemo } from "react";
import type React from "react";
import type {
  CaptionPayload,
  ScreenshotLifecyclePayload,
  SubtitlePayload,
  VideoController,
} from "../types/control";

interface ControlSocketHandlerOptions {
  clientId: string;
  applySubtitle: (value: string | null) => void;
  applyCaption: (value: string | null) => void;
  applyRemoteIframeConfig: (config: Record<string, unknown>) => void;
  applyRemoteCollageConfig: (config: Record<string, unknown>) => void;
  markRequestDone: (requestId: string) => void;
  unlockAudioElementRef: React.RefObject<HTMLAudioElement | null>;
  videoControllerRef: React.RefObject<VideoController | null>;
}

export function useControlSocketHandlers({
  clientId,
  applySubtitle,
  applyCaption,
  applyRemoteIframeConfig,
  applyRemoteCollageConfig,
  markRequestDone,
  unlockAudioElementRef,
  videoControllerRef,
}: ControlSocketHandlerOptions) {
  const handleScreenshotLifecycle = useCallback(
    (payload: ScreenshotLifecyclePayload) => {
      if (payload?.request_id) {
        markRequestDone(payload.request_id);
      }
    },
    [markRequestDone],
  );

  const handleSubtitleMessage = useCallback(
    (payload: SubtitlePayload) => {
      const targetId = payload?.target_client_id;
      if (targetId && targetId !== clientId) {
        return;
      }
      applySubtitle(payload?.subtitle ?? null);
    },
    [clientId, applySubtitle],
  );

  const handleCaptionMessage = useCallback(
    (payload: CaptionPayload) => {
      const targetId = payload?.target_client_id;
      if (targetId && targetId !== clientId) {
        return;
      }
      applyCaption(payload?.caption ?? null);
    },
    [clientId, applyCaption],
  );

  const handleIframeConfigMessage = useCallback(
    (payload: Record<string, unknown>) => {
      const config = payload?.config;
      if (!config || typeof config !== "object") return;
      const targetId = payload?.target_client_id as string | undefined;
      if (targetId && targetId !== clientId) {
        return;
      }
      applyRemoteIframeConfig(config as Record<string, unknown>);
    },
    [clientId, applyRemoteIframeConfig],
  );

  const handleCollageConfigMessage = useCallback(
    (payload: Record<string, unknown>) => {
      const config = payload?.config;
      if (!config || typeof config !== "object") return;
      const targetId = payload?.target_client_id as string | undefined;
      if (targetId && targetId !== clientId) {
        return;
      }
      applyRemoteCollageConfig(payload);
    },
    [clientId, applyRemoteCollageConfig],
  );

  const handleUnlockAudioMessage = useCallback(
    (payload: Record<string, unknown>) => {
      const targetId = payload?.target_client_id as string | undefined;
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
    (payload: Record<string, unknown>) => {
      const targetId = payload?.target_client_id as string | undefined;
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

      let targetNode: Element | null = null;
      let rootNode: Element | null = null;
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
      if (typeof (targetNode as HTMLElement).click === "function") {
        (targetNode as HTMLElement).click();
      }
    },
    [clientId],
  );

  const handleVideoControlMessage = useCallback(
    (payload: Record<string, unknown>) => {
      const targetId = payload?.target_client_id as string | undefined;
      if (targetId && targetId !== clientId) {
        return;
      }
      const controller = videoControllerRef.current;
      if (!controller || typeof payload !== "object" || !payload) {
        return;
      }
      const action = typeof payload.action === "string" ? payload.action.trim().toLowerCase() : "";
      const timeValue = (payload as { time?: unknown }).time;
      const volumeValue = (payload as { volume?: unknown }).volume;
      const mutedValue = (payload as { muted?: unknown }).muted;
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
      if (action === "seek" && timeValue != null) {
        controller.seek?.(Number(timeValue));
        return;
      }
      if (action === "set_volume" || action === "volume") {
        controller.setVolume?.(typeof volumeValue === "number" ? volumeValue : undefined);
        return;
      }
      if (action === "set_muted") {
        controller.setMuted?.(Boolean(mutedValue));
        return;
      }
      if (action === "mute") {
        controller.setMuted?.(true);
        return;
      }
      if (action === "unmute") {
        controller.setMuted?.(false);
        if (typeof volumeValue === "number") {
          controller.setVolume?.(volumeValue);
        }
      }
    },
    [clientId, videoControllerRef],
  );

  const handlers = useMemo(
    () => ({
      handleScreenshotLifecycle,
      handleSubtitleMessage,
      handleCaptionMessage,
      handleIframeConfigMessage,
      handleCollageConfigMessage,
      handleUnlockAudioMessage,
      handleRemoteClickMessage,
      handleVideoControlMessage,
    }),
    [
      handleScreenshotLifecycle,
      handleSubtitleMessage,
      handleCaptionMessage,
      handleIframeConfigMessage,
      handleCollageConfigMessage,
      handleUnlockAudioMessage,
      handleRemoteClickMessage,
      handleVideoControlMessage,
    ],
  );

  return handlers;
}
