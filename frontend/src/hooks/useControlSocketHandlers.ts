import { useCallback, useEffect, useMemo, useRef } from "react";
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
  const mediaControlStateRef = useRef<{ volume: number | null; muted: boolean | null } | null>(null);
  const mediaControlIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
      if (!payload || typeof payload !== "object") {
        return;
      }
      const action = typeof payload.action === "string" ? payload.action.trim().toLowerCase() : "";
      const timeValue = (payload as { time?: unknown }).time;
      const volumeValue = (payload as { volume?: unknown }).volume;
      const mutedValue = (payload as { muted?: unknown }).muted;
      if (!action) {
        return;
      }
      const clampVolume = (value: unknown): number | undefined => {
        if (typeof value !== "number") return undefined;
        return Math.max(0, Math.min(1, value));
      };

      const applyToDocumentMedia = (doc: Document, fn: (media: HTMLMediaElement) => void, depth = 0): void => {
        if (!doc || depth > 4) return; // avoid deep loops
        const elements = Array.from(doc.querySelectorAll("video, audio"));
        elements.forEach((media) => {
          try {
            fn(media as HTMLMediaElement);
          } catch (err) {
            // ignore per-element errors
          }
        });
        const frames = Array.from(doc.querySelectorAll("iframe"));
        frames.forEach((frame) => {
          try {
            const childDoc = frame.contentDocument;
            if (childDoc) {
              applyToDocumentMedia(childDoc, fn, depth + 1);
            }
          } catch (err) {
            // cross-origin or inaccessible; skip
          }
        });
      };

      const applyToMediaElements = (fn: (media: HTMLMediaElement) => void): void => {
        applyToDocumentMedia(document, fn);
      };

      const rememberControlState = (volume: number | null, muted: boolean | null, enableInterval: boolean): void => {
        mediaControlStateRef.current = { volume, muted };
        if (!enableInterval) return;
        if (!mediaControlIntervalRef.current) {
          mediaControlIntervalRef.current = setInterval(() => {
            const state = mediaControlStateRef.current;
            if (!state) return;
            applyToMediaElements((media) => {
              if (state.volume !== null && state.volume !== undefined) {
                media.volume = state.volume;
                if (state.volume > 0 && media.muted && state.muted !== true) {
                  media.muted = false;
                }
              }
              if (state.muted !== null && state.muted !== undefined) {
                media.muted = state.muted;
              }
            });
          }, 1000);
        }
      };

      // Primary: dedicated controller (VideoMode)
      const controller = videoControllerRef.current;
      if (controller) {
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
          const vol = typeof volumeValue === "number" ? volumeValue : undefined;
          controller.setVolume?.(vol);
          return;
        }
        if (action === "set_muted") {
          const muted = Boolean(mutedValue);
          controller.setMuted?.(muted);
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
          return;
        }
        return;
      }

      // Fallback: apply to all media elements in the page (iframe/collage panels)

      if (action === "play") {
        applyToMediaElements((media) => {
          void media.play().catch(() => undefined);
        });
        rememberControlState(mediaControlStateRef.current?.volume ?? null, mediaControlStateRef.current?.muted ?? null, true);
        return;
      }
      if (action === "pause") {
        applyToMediaElements((media) => {
          media.pause();
        });
        rememberControlState(mediaControlStateRef.current?.volume ?? null, mediaControlStateRef.current?.muted ?? null, true);
        return;
      }
      if (action === "seek" && timeValue != null) {
        const parsed = Number(timeValue);
        if (!Number.isFinite(parsed) || parsed < 0) return;
        applyToMediaElements((media) => {
          try {
            media.currentTime = parsed;
          } catch (err) {
            // ignore seek errors
          }
        });
        rememberControlState(mediaControlStateRef.current?.volume ?? null, mediaControlStateRef.current?.muted ?? null, true);
        return;
      }
      if (action === "set_volume" || action === "volume") {
        const vol = clampVolume(volumeValue);
        if (vol == null) return;
        applyToMediaElements((media) => {
          media.volume = vol;
          if (vol > 0 && media.muted) {
            media.muted = false;
          }
        });
        rememberControlState(vol, mediaControlStateRef.current?.muted ?? null, true);
        return;
      }
      if (action === "set_muted") {
        const muted = Boolean(mutedValue);
        applyToMediaElements((media) => {
          media.muted = muted;
        });
        rememberControlState(mediaControlStateRef.current?.volume ?? null, muted, true);
        return;
      }
      if (action === "mute") {
        applyToMediaElements((media) => {
          media.muted = true;
        });
        rememberControlState(mediaControlStateRef.current?.volume ?? null, true, true);
        return;
      }
      if (action === "unmute") {
        const vol = clampVolume(volumeValue);
        applyToMediaElements((media) => {
          media.muted = false;
          if (vol != null) {
            media.volume = vol;
          }
        });
        rememberControlState(vol ?? mediaControlStateRef.current?.volume ?? null, false, true);
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

  useEffect(
    () => () => {
      if (mediaControlIntervalRef.current) {
        clearInterval(mediaControlIntervalRef.current);
        mediaControlIntervalRef.current = null;
      }
    },
    [],
  );

  return handlers;
}
