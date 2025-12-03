import { useCallback, useMemo, useState } from "react";
import type { SnapshotConfig, SnapshotPanel } from "../types/admin";
import type { IframePanelConfig } from "../types/control";
import type { EpisodeEntry, EpisodeTrack, IframeTimeline, TimelineStep } from "../types/timeline";
import type { EditorMode } from "../utils/adminEditorUtils";

interface ClipboardState {
  mode: EditorMode;
  items: Array<Record<string, unknown>>;
}

interface UseTimelineEpisodeClipboardParams {
  mode: EditorMode;
  timelineData: IframeTimeline;
  episodeData: EpisodeEntry;
  snapshotData: SnapshotConfig;
  updateTimeline: (next: IframeTimeline, options?: { markDirty?: boolean }) => void;
  setEpisodeState: (next: EpisodeEntry | ((prev: EpisodeEntry) => EpisodeEntry), options?: { markDirty?: boolean }) => void;
  updateSnapshot: (next: SnapshotConfig, options?: { markDirty?: boolean }) => void;
  setMessageForMode: (value: string, targetMode?: EditorMode) => void;
}

export default function useTimelineEpisodeClipboard({
  episodeData,
  mode,
  setEpisodeState,
  setMessageForMode,
  snapshotData,
  timelineData,
  updateSnapshot,
  updateTimeline,
}: UseTimelineEpisodeClipboardParams) {
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [clipboard, setClipboard] = useState<ClipboardState | null>(null);
  const [batchDuration, setBatchDuration] = useState("");
  const [batchTargetClient, setBatchTargetClient] = useState("");

  const focusRow = useCallback((index: number) => {
    setSelectedRows([index]);
  }, []);

  const moveRow = useCallback(
    (index: number, delta: number) => {
      if (mode === "timeline") {
        const steps = [...(timelineData.steps || [])];
        const target = index + delta;
        if (target < 0 || target >= steps.length) return;
        const [item] = steps.splice(index, 1);
        steps.splice(target, 0, item);
        updateTimeline({ ...timelineData, steps } as IframeTimeline);
      } else if (mode === "episode") {
        const tracks = [...(episodeData.tracks || [])];
        const target = index + delta;
        if (target < 0 || target >= tracks.length) return;
        const [item] = tracks.splice(index, 1);
        tracks.splice(target, 0, item);
        setEpisodeState({ ...episodeData, tracks } as EpisodeEntry);
      } else {
        const panels = [...(snapshotData.panels || [])];
        const target = index + delta;
        if (target < 0 || target >= panels.length) return;
        const [item] = panels.splice(index, 1);
        panels.splice(target, 0, item);
        updateSnapshot({ ...snapshotData, panels } as SnapshotConfig);
      }
    },
    [episodeData, mode, setEpisodeState, snapshotData, timelineData, updateSnapshot, updateTimeline],
  );

  const removeRow = useCallback(
    (index: number) => {
      if (mode === "timeline") {
        updateTimeline({ ...timelineData, steps: (timelineData.steps || []).filter((_, i) => i !== index) } as IframeTimeline);
      } else if (mode === "episode") {
        setEpisodeState({ ...episodeData, tracks: (episodeData.tracks || []).filter((_, i) => i !== index) } as EpisodeEntry);
      } else {
        updateSnapshot({ ...snapshotData, panels: (snapshotData.panels || []).filter((_, i) => i !== index) } as SnapshotConfig);
      }
      setSelectedRows((prev) => prev.filter((i) => i !== index));
    },
    [episodeData, mode, setEpisodeState, snapshotData, timelineData, updateSnapshot, updateTimeline],
  );

  const duplicateRow = useCallback(
    (index: number) => {
      if (mode === "timeline") {
        const steps = [...(timelineData.steps || [])];
        const target = steps[index];
        steps.splice(index + 1, 0, { ...target });
        updateTimeline({ ...timelineData, steps } as IframeTimeline);
      } else if (mode === "episode") {
        const tracks = [...(episodeData.tracks || [])];
        const target = tracks[index];
        tracks.splice(index + 1, 0, { ...target });
        setEpisodeState({ ...episodeData, tracks } as EpisodeEntry);
      } else {
        const panels = [...(snapshotData.panels || [])];
        const target = panels[index];
        panels.splice(index + 1, 0, { ...target });
        updateSnapshot({ ...snapshotData, panels } as SnapshotConfig);
      }
    },
    [episodeData, mode, setEpisodeState, snapshotData, timelineData, updateSnapshot, updateTimeline],
  );

  const handleCopy = useCallback(() => {
    if (!selectedRows.length) return;
    const items = selectedRows
      .map((idx) =>
        mode === "timeline"
          ? timelineData.steps?.[idx]
          : mode === "episode"
            ? episodeData.tracks?.[idx]
            : snapshotData.panels?.[idx],
      )
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
    setClipboard({ mode, items });
    setMessageForMode(`已複製 ${items.length} 筆`);
  }, [episodeData.tracks, mode, selectedRows, setMessageForMode, snapshotData.panels, timelineData.steps]);

  const handlePaste = useCallback(() => {
    if (!clipboard || clipboard.mode !== mode || !clipboard.items?.length) return;
    const clonedItems = clipboard.items.map((item) => ({ ...item }));
    if (mode === "timeline") {
      updateTimeline({
        ...timelineData,
        steps: [...(timelineData.steps || []), ...(clonedItems as unknown as TimelineStep[])],
      } as IframeTimeline);
    } else if (mode === "episode") {
      setEpisodeState({
        ...episodeData,
        tracks: [...(episodeData.tracks || []), ...(clonedItems as unknown as EpisodeTrack[])],
      } as EpisodeEntry);
    } else {
      updateSnapshot({
        ...snapshotData,
        panels: [...(snapshotData.panels || []), ...(clonedItems as unknown as IframePanelConfig[])],
      } as SnapshotConfig);
    }
    setMessageForMode(`已貼上 ${clipboard.items.length} 筆`);
  }, [clipboard, episodeData, mode, setEpisodeState, setMessageForMode, snapshotData, timelineData, updateSnapshot, updateTimeline]);

  const handleBatchApply = useCallback(() => {
    if (!selectedRows.length) return;
    if (mode === "timeline" && batchDuration) {
      updateTimeline({
        ...timelineData,
        steps: (timelineData.steps || []).map((step, idx) =>
          selectedRows.includes(idx) ? { ...step, duration: Number(batchDuration) } : step,
        ),
      } as IframeTimeline);
    }
    if (mode === "episode" && batchTargetClient) {
      setEpisodeState({
        ...episodeData,
        tracks: (episodeData.tracks || []).map((track, idx) =>
          selectedRows.includes(idx) ? { ...track, targetClientId: batchTargetClient } : track,
        ),
      } as EpisodeEntry);
    }
  }, [batchDuration, batchTargetClient, episodeData, mode, selectedRows, setEpisodeState, timelineData, updateTimeline]);

  const canTimelinePaste = useMemo(() => Boolean(clipboard && clipboard.mode === "timeline"), [clipboard]);
  const canEpisodePaste = useMemo(() => Boolean(clipboard && clipboard.mode === "episode"), [clipboard]);
  const canSnapshotPaste = useMemo(() => Boolean(clipboard && clipboard.mode === "snapshot"), [clipboard]);

  return {
    selectedRows,
    setSelectedRows,
    batchDuration,
    setBatchDuration,
    batchTargetClient,
    setBatchTargetClient,
    canTimelinePaste,
    canEpisodePaste,
    canSnapshotPaste,
    handleCopy,
    handlePaste,
    handleBatchApply,
    moveRow,
    duplicateRow,
    removeRow,
    focusRow,
  };
}
