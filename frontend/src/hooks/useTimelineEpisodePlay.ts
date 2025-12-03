import { useCallback, useEffect, useState } from "react";
import { timelinePlaybackSrc, parseTargetMap } from "../adminPanelUtils";
import { playEpisode, playIframeTimeline, restoreIframeSnapshot } from "../api";
import type { EpisodeEntry, IframeTimeline } from "../types/timeline";
import type { EditorMode } from "../utils/adminEditorUtils";

interface UseTimelineEpisodePlayParams {
  mode: EditorMode;
  timelineData: IframeTimeline;
  episodeData: EpisodeEntry;
  snapshotClient: string | undefined | null;
  snapshotName: string;
  episodeTargetOverride: string;
  dirty: boolean;
  handleSave: () => Promise<boolean>;
  setMessageForMode: (value: string, targetMode?: EditorMode) => void;
}

export default function useTimelineEpisodePlay({
  dirty,
  episodeData,
  episodeTargetOverride,
  handleSave,
  mode,
  setMessageForMode,
  snapshotClient,
  snapshotName,
  timelineData,
}: UseTimelineEpisodePlayParams) {
  const [timelinePlaySrc, setTimelinePlaySrc] = useState<string | null>(null);
  const [timelinePlayError, setTimelinePlayError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "timeline") {
      setTimelinePlaySrc(null);
      setTimelinePlayError(null);
    }
  }, [mode]);

  const handlePlayPreview = useCallback(async () => {
    if (mode !== "timeline") return;
    const id = timelineData.id;
    if (!id) {
      setTimelinePlayError("請先設定 id");
      return;
    }
    if (dirty) {
      const ok = await handleSave();
      if (!ok) {
        setTimelinePlayError("儲存失敗，無法預覽");
        return;
      }
    }
    setTimelinePlayError(null);
    setTimelinePlaySrc(timelinePlaybackSrc(id));
  }, [dirty, handleSave, mode, timelineData.id]);

  const handlePlayTimelineToClient = useCallback(async () => {
    if (mode !== "timeline") return;
    const id = timelineData.id;
    if (!id) {
      setMessageForMode("請先設定 timeline id", "timeline");
      return;
    }
    try {
      const targetClientId = timelineData.clientId ?? (timelineData as { client_id?: string | null }).client_id ?? null;
      await playIframeTimeline(id, {}, { targetClientId });
      setMessageForMode("已送出 timeline 播放", "timeline");
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : "播放失敗";
      setMessageForMode(errMessage, "timeline");
    }
  }, [mode, setMessageForMode, timelineData.clientId, timelineData.id, timelineData]);

  const handlePlayEpisode = useCallback(async () => {
    if (mode !== "episode") return;
    const id = episodeData.id;
    if (!id) {
      setMessageForMode("請先設定 episode id", "episode");
      return;
    }
    const payload: Record<string, unknown> = {};
    const map = parseTargetMap(episodeTargetOverride);
    if (map && Object.keys(map).length > 0) {
      payload.target_client_map = map;
    }
    try {
      await playEpisode(id, payload);
      setMessageForMode("已送出 episode 播放", "episode");
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : "播放失敗";
      setMessageForMode(errMessage, "episode");
    }
  }, [episodeData.id, episodeTargetOverride, mode, setMessageForMode]);

  const handlePlaySnapshot = useCallback(async () => {
    if (mode !== "snapshot") return;
    const client = (snapshotClient || "").trim();
    const name = (snapshotName || "").trim();
    if (!client || !name) {
      setMessageForMode("請先設定 client 與 snapshot 名稱", "snapshot");
      return;
    }
    if (dirty) {
      const ok = await handleSave();
      if (!ok) {
        setMessageForMode("儲存失敗，無法播放", "snapshot");
        return;
      }
    }
    try {
      setMessageForMode(`播放中 ${name} → ${client}...`, "snapshot");
      await restoreIframeSnapshot(client, name);
      setMessageForMode(`已送出 snapshot 到 ${client}`, "snapshot");
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : "播放失敗";
      setMessageForMode(errMessage, "snapshot");
    }
  }, [dirty, handleSave, mode, setMessageForMode, snapshotClient, snapshotName]);

  return {
    timelinePlaySrc,
    timelinePlayError,
    handlePlayPreview,
    handlePlayTimelineToClient,
    handlePlayEpisode,
    handlePlaySnapshot,
  };
}
