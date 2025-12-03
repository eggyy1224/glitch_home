import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getIframeSnapshot } from "../api";
import { firstSnapshotRef, previewSrcFromConfig } from "../adminPanelUtils";
import type { SnapshotConfig } from "../types/admin";
import type { IframeTimeline } from "../types/timeline";
import type { EditorMode } from "../utils/adminEditorUtils";

interface UseTimelineEpisodePreviewParams {
  mode: EditorMode;
  timelineData: IframeTimeline;
  snapshotData: SnapshotConfig;
}

export default function useTimelineEpisodePreview({ mode, snapshotData, timelineData }: UseTimelineEpisodePreviewParams) {
  const [timelinePreviewSrc, setTimelinePreviewSrc] = useState<string | null>(null);
  const [timelinePreviewError, setTimelinePreviewError] = useState<string | null>(null);
  const [snapshotPreviewSrc, setSnapshotPreviewSrc] = useState<string | null>(null);
  const [snapshotPreviewError, setSnapshotPreviewError] = useState<string | null>(null);
  const [snapshotPreviewWidth, setSnapshotPreviewWidth] = useState<number>(() => {
    if (typeof window === "undefined") return 960;
    return Math.max(Math.min(window.innerWidth - 100, 1200), 720);
  });

  const clampSnapshotPreviewWidth = useCallback((width: number) => {
    const max = typeof window !== "undefined" ? Math.max(window.innerWidth - 60, 640) : 1400;
    return Math.min(Math.max(width, 560), Math.min(max, 1800));
  }, []);

  const snapshotFrameHeight = useMemo(
    () => Math.max(320, Math.round((snapshotPreviewWidth * 9) / 16)),
    [snapshotPreviewWidth],
  );

  const startSnapshotResize = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = snapshotPreviewWidth;
      const onMove = (e: MouseEvent) => {
        const delta = e.clientX - startX;
        setSnapshotPreviewWidth(clampSnapshotPreviewWidth(startWidth + delta));
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [clampSnapshotPreviewWidth, snapshotPreviewWidth],
  );

  const setSnapshotPreviewFromConfig = useCallback((config: Partial<SnapshotConfig>) => {
    try {
      const src = previewSrcFromConfig(config);
      setSnapshotPreviewSrc(src);
      setSnapshotPreviewError(src ? null : "預覽來源不足");
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : "預覽取得失敗";
      setSnapshotPreviewSrc(null);
      setSnapshotPreviewError(errMessage);
    }
  }, []);

  useEffect(() => {
    if (mode !== "timeline") return undefined;
    let cancelled = false;
    const controller = new AbortController();
    const fetchPreview = async () => {
      try {
        const first = firstSnapshotRef(timelineData);
        if (!first) {
          setTimelinePreviewSrc(null);
          setTimelinePreviewError("無 snapshot 可預覽");
          return;
        }
        const snapshot = await getIframeSnapshot(first.client, first.name, { signal: controller.signal });
        if (cancelled) return;
        const raw = (snapshot as { raw?: unknown; snapshot?: unknown }).raw || (snapshot as { snapshot?: unknown }).snapshot || snapshot;
        const src = previewSrcFromConfig(raw as Partial<SnapshotConfig>);
        setTimelinePreviewError(src ? null : "預覽來源不足");
        setTimelinePreviewSrc(src);
      } catch (err) {
        if (cancelled || (err as { name?: string }).name === "AbortError") return;
        const errMessage = err instanceof Error ? err.message : "預覽取得失敗";
        setTimelinePreviewError(errMessage);
        setTimelinePreviewSrc(null);
      }
    };
    void fetchPreview();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [mode, timelineData]);

  useEffect(() => {
    if (mode !== "snapshot") return;
    setSnapshotPreviewFromConfig(snapshotData);
  }, [mode, setSnapshotPreviewFromConfig, snapshotData]);

  return {
    timelinePreviewSrc,
    timelinePreviewError,
    snapshotPreviewSrc,
    snapshotPreviewError,
    snapshotPreviewWidth,
    snapshotFrameHeight,
    startSnapshotResize,
    setSnapshotPreviewFromConfig,
  };
}
