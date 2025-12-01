import { useCallback, useEffect, useRef, useState } from "react";
import { fetchCaptionState, fetchSubtitleState } from "../api";

interface OverlayPayload {
  text: string;
  language: string | null;
  durationSeconds: number | null;
  expiresAt: string | null;
  updatedAt: string | null;
}

const normalizeOverlayPayload = (payload: unknown): OverlayPayload | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const textValue = "text" in payload ? String((payload as { text?: unknown }).text ?? "") : "";
  if (!textValue.trim()) {
    return null;
  }
  const languageRaw =
    typeof (payload as { language?: unknown }).language === "string" ? (payload as { language?: string }).language?.trim() : null;
  const durationRaw = (payload as { duration_seconds?: unknown }).duration_seconds;
  const expiresRaw = (payload as { expires_at?: unknown }).expires_at;
  const updatedRaw = (payload as { updated_at?: unknown }).updated_at;

  return {
    text: textValue,
    language: languageRaw && languageRaw.trim() ? languageRaw.trim() : null,
    durationSeconds:
      typeof durationRaw === "number" && Number.isFinite(durationRaw) && durationRaw > 0
        ? durationRaw
        : null,
    expiresAt: typeof expiresRaw === "string" ? expiresRaw : null,
    updatedAt: typeof updatedRaw === "string" ? updatedRaw : null,
  };
};

const createApplyOverlay = (
  setState: React.Dispatch<React.SetStateAction<OverlayPayload | null>>,
  timerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
  clearTimer: () => void,
) =>
  useCallback(
    (payload: unknown) => {
      clearTimer();
      const normalized = normalizeOverlayPayload(payload);
      if (!normalized) {
        setState(null);
        return;
      }

      setState(normalized);

      let delayMs: number | null = null;
      if (normalized.expiresAt) {
        const expiresTs = Date.parse(normalized.expiresAt);
        if (!Number.isNaN(expiresTs)) {
          delayMs = Math.max(0, expiresTs - Date.now());
        }
      }
      if (delayMs === null && typeof normalized.durationSeconds === "number") {
        delayMs = normalized.durationSeconds * 1000;
      }

      if (delayMs !== null) {
        const expectedUpdatedAt = normalized.updatedAt;
        timerRef.current = setTimeout(() => {
          setState((current) => {
            if (!current) return current;
            if (expectedUpdatedAt && current.updatedAt !== expectedUpdatedAt) {
              return current;
            }
            return null;
          });
          timerRef.current = null;
        }, delayMs);
      }
    },
    [clearTimer, setState, timerRef],
  );

export interface SubtitleCaptionState {
  subtitle: OverlayPayload | null;
  caption: OverlayPayload | null;
  applySubtitle: (payload: unknown) => void;
  applyCaption: (payload: unknown) => void;
}

export function useSubtitleCaption(clientId: string | null): SubtitleCaptionState {
  const [subtitle, setSubtitle] = useState<OverlayPayload | null>(null);
  const [caption, setCaption] = useState<OverlayPayload | null>(null);

  const subtitleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSubtitleTimer = useCallback((): void => {
    if (subtitleTimerRef.current) {
      clearTimeout(subtitleTimerRef.current);
      subtitleTimerRef.current = null;
    }
  }, []);

  const clearCaptionTimer = useCallback((): void => {
    if (captionTimerRef.current) {
      clearTimeout(captionTimerRef.current);
      captionTimerRef.current = null;
    }
  }, []);

  const applySubtitle = createApplyOverlay(setSubtitle, subtitleTimerRef, clearSubtitleTimer);
  const applyCaption = createApplyOverlay(setCaption, captionTimerRef, clearCaptionTimer);

  useEffect(() => {
    let active = true;
    if (!clientId) return undefined;
    fetchSubtitleState(clientId)
      .then(({ subtitle: initialSubtitle }) => {
        if (!active) return;
        applySubtitle(initialSubtitle ?? null);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [applySubtitle, clientId]);

  useEffect(() => {
    let active = true;
    if (!clientId) return undefined;
    fetchCaptionState(clientId)
      .then(({ caption: initialCaption }) => {
        if (!active) return;
        applyCaption(initialCaption ?? null);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [applyCaption, clientId]);

  useEffect(() => () => {
    clearSubtitleTimer();
    clearCaptionTimer();
  }, [clearSubtitleTimer, clearCaptionTimer]);

  return {
    subtitle,
    caption,
    applySubtitle,
    applyCaption,
  };
}
