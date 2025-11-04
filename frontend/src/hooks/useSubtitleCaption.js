import { useCallback, useEffect, useRef, useState } from "react";
import { fetchCaptionState, fetchSubtitleState } from "../api.js";

const normalizeOverlayPayload = (payload) => {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const textValue = "text" in payload ? String(payload.text ?? "") : "";
  if (!textValue.trim()) {
    return null;
  }
  return {
    text: textValue,
    language: typeof payload.language === "string" && payload.language.trim() ? payload.language.trim() : null,
    durationSeconds:
      typeof payload.duration_seconds === "number" &&
      Number.isFinite(payload.duration_seconds) &&
      payload.duration_seconds > 0
        ? payload.duration_seconds
        : null,
    expiresAt: typeof payload.expires_at === "string" ? payload.expires_at : null,
    updatedAt: typeof payload.updated_at === "string" ? payload.updated_at : null,
  };
};

const createApplyOverlay = (setState, timerRef, clearTimer) =>
  useCallback(
    (payload) => {
      clearTimer();
      const normalized = normalizeOverlayPayload(payload);
      if (!normalized) {
        setState(null);
        return;
      }

      setState(normalized);

      let delayMs = null;
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

export function useSubtitleCaption(clientId) {
  const [subtitle, setSubtitle] = useState(null);
  const [caption, setCaption] = useState(null);

  const subtitleTimerRef = useRef(null);
  const captionTimerRef = useRef(null);

  const clearSubtitleTimer = useCallback(() => {
    if (subtitleTimerRef.current) {
      clearTimeout(subtitleTimerRef.current);
      subtitleTimerRef.current = null;
    }
  }, []);

  const clearCaptionTimer = useCallback(() => {
    if (captionTimerRef.current) {
      clearTimeout(captionTimerRef.current);
      captionTimerRef.current = null;
    }
  }, []);

  const applySubtitle = createApplyOverlay(setSubtitle, subtitleTimerRef, clearSubtitleTimer);
  const applyCaption = createApplyOverlay(setCaption, captionTimerRef, clearCaptionTimer);

  useEffect(() => {
    let active = true;
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
