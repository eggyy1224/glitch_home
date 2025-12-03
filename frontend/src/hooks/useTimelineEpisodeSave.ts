import { useCallback, useState } from "react";
import {
  createEpisode,
  createIframeTimeline,
  saveIframeSnapshot,
  updateEpisode as updateEpisodeApi,
  updateIframeTimeline,
} from "../api";
import type { SnapshotConfig } from "../types/admin";
import type { EpisodeEntry, IframeTimeline } from "../types/timeline";
import type { EditorMode } from "../utils/adminEditorUtils";
import { validateSnapshot } from "../utils/adminEditorUtils";

interface UseTimelineEpisodeSaveParams {
  mode: EditorMode;
  timelineData: IframeTimeline;
  episodeData: EpisodeEntry;
  snapshotData: SnapshotConfig;
  snapshotClient: string | undefined | null;
  snapshotName: string;
  setSnapshotName: (value: string) => void;
  defaultClientId?: string | null;
  updateTimeline: (next: IframeTimeline, options?: { markDirty?: boolean }) => void;
  setEpisodeState: (next: EpisodeEntry | ((prev: EpisodeEntry) => EpisodeEntry), options?: { markDirty?: boolean }) => void;
  updateSnapshot: (next: SnapshotConfig, options?: { markDirty?: boolean }) => void;
  refreshTimelines: () => Promise<void>;
  refreshEpisodes: () => Promise<void>;
  refreshSnapshots: (clientOverride?: string | null) => Promise<void>;
  setMessageForMode: (value: string, targetMode?: EditorMode) => void;
  onSaved?: () => void;
}

export default function useTimelineEpisodeSave({
  defaultClientId,
  episodeData,
  mode,
  onSaved,
  refreshEpisodes,
  refreshSnapshots,
  refreshTimelines,
  setEpisodeState,
  setMessageForMode,
  setSnapshotName,
  snapshotClient,
  snapshotData,
  snapshotName,
  timelineData,
  updateSnapshot,
  updateTimeline,
}: UseTimelineEpisodeSaveParams) {
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    try {
      setIsSaving(true);
      if (mode === "timeline") {
        const payload = timelineData;
        const targetId = (payload.id || "").trim();
        if (!targetId) throw new Error("timeline id 必填");
        const normalizedPayload = { ...payload, id: targetId };
        updateTimeline(normalizedPayload as IframeTimeline);
        let action: "update" | "create" = "update";
        try {
          await updateIframeTimeline(targetId, normalizedPayload, { resolve: false });
        } catch (err) {
          const msg = (err as Error)?.message || "";
          if (msg.includes("404")) {
            action = "create";
            await createIframeTimeline(normalizedPayload, { resolve: false });
          } else {
            throw err;
          }
        }
        setMessageForMode(`${action === "update" ? "已更新" : "已建立"} timeline ${targetId}`, "timeline");
        await refreshTimelines();
      } else if (mode === "episode") {
        const payload = episodeData;
        const targetId = (payload.id || "").trim();
        if (!targetId) throw new Error("episode id 必填");
        const normalizedPayload = { ...payload, id: targetId };
        setEpisodeState(normalizedPayload as EpisodeEntry);
        let action: "update" | "create" = "update";
        try {
          await updateEpisodeApi(targetId, normalizedPayload, { resolve: false });
        } catch (err) {
          const msg = (err as Error)?.message || "";
          if (msg.includes("404")) {
            action = "create";
            await createEpisode(normalizedPayload, { resolve: false });
          } else {
            throw err;
          }
        }
        setMessageForMode(`${action === "update" ? "已更新" : "已建立"} episode ${targetId}`, "episode");
        await refreshEpisodes();
      } else {
        const payload = snapshotData;
        const client = (snapshotClient || defaultClientId || "").trim();
        const name = (snapshotName || "").trim();
        if (!client) throw new Error("client 必填");
        if (!name) throw new Error("snapshot 名稱必填");
        const errors = validateSnapshot(payload);
        if (errors.length) {
          const first = errors[0];
          throw new Error(`驗證錯誤：${first.path} ${first.message}`);
        }
        updateSnapshot(payload);
        await saveIframeSnapshot(client, name, payload);
        setSnapshotName(name);
        setMessageForMode(`已儲存 snapshot ${client}/${name}`, "snapshot");
        await refreshSnapshots(client);
      }
      onSaved?.();
      return true;
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : "儲存失敗";
      setMessageForMode(errMessage, mode);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [
    defaultClientId,
    episodeData,
    mode,
    onSaved,
    refreshEpisodes,
    refreshSnapshots,
    refreshTimelines,
    setEpisodeState,
    setMessageForMode,
    snapshotClient,
    snapshotData,
    snapshotName,
    setSnapshotName,
    timelineData,
    updateSnapshot,
    updateTimeline,
  ]);

  return { isSaving, handleSave };
}
