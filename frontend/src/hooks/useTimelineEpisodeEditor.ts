import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { fetchEpisode, fetchIframeTimeline, getIframeSnapshot } from "../api";
import { AdminPanelContext } from "../AdminPanelContext";
import { defaultEpisodePayload, defaultTimelinePayload, minimalConfigPayload, pretty } from "../adminPanelUtils";
import type { SnapshotConfig } from "../types/admin";
import type { EpisodeEntry, EpisodeTrack, IframeTimeline, TimelineStep } from "../types/timeline";
import type { EditorMode, EditorValidationError } from "../utils/adminEditorUtils";
import { validateEpisode, validateSnapshot, validateTimeline } from "../utils/adminEditorUtils";
import useSnapshotList from "./useSnapshotList";
import useTimelineEpisodeClipboard from "./useTimelineEpisodeClipboard";
import useTimelineEpisodeJson from "./useTimelineEpisodeJson";
import useTimelineEpisodeLists from "./useTimelineEpisodeLists";
import useTimelineEpisodeMessages from "./useTimelineEpisodeMessages";
import useTimelineEpisodePlay from "./useTimelineEpisodePlay";
import useTimelineEpisodePreview from "./useTimelineEpisodePreview";
import useTimelineEpisodeSave from "./useTimelineEpisodeSave";

export default function useTimelineEpisodeEditor() {
  const { defaultClientId } = useContext(AdminPanelContext);
  const [mode, setMode] = useState<EditorMode>("timeline");
  const [timelineData, setTimelineData] = useState<IframeTimeline>(() => defaultTimelinePayload(defaultClientId));
  const [episodeData, setEpisodeData] = useState<EpisodeEntry>(() => defaultEpisodePayload(defaultClientId));
  const [snapshotData, setSnapshotData] = useState<SnapshotConfig>(() => minimalConfigPayload(defaultClientId));
  const [dirty, setDirty] = useState(false);
  const [validationErrors, setValidationErrors] = useState<EditorValidationError[]>([]);
  const [jsonLocked, setJsonLocked] = useState(false);
  const [jsonReadOnly, setJsonReadOnly] = useState(false);
  const [episodeTargetOverride, setEpisodeTargetOverride] = useState("");

  const { message, setMessageForMode } = useTimelineEpisodeMessages(mode);

  const {
    timelineList,
    episodeList,
    timelineFilter,
    episodeFilter,
    setTimelineFilter,
    setEpisodeFilter,
    refreshTimelines,
    refreshEpisodes,
  } = useTimelineEpisodeLists({ setMessageForMode });

  const {
    snapshotClient,
    setSnapshotClient,
    snapshotKeyword,
    setSnapshotKeyword,
    snapshotName,
    setSnapshotName,
    snapshotOptions,
    snapshotMessage,
    refreshSnapshots,
  } = useSnapshotList({ defaultClientId, setMessageForMode });

  const {
    timelinePreviewSrc,
    timelinePreviewError,
    snapshotPreviewSrc,
    snapshotPreviewError,
    snapshotPreviewWidth,
    snapshotFrameHeight,
    startSnapshotResize,
    setSnapshotPreviewFromConfig,
  } = useTimelineEpisodePreview({ mode, timelineData, snapshotData });

  const initialJson = useMemo(() => pretty(defaultTimelinePayload(defaultClientId)), [defaultClientId]);

  const handleTimelineParsed = useCallback((next: IframeTimeline) => {
    setTimelineData(next);
  }, []);

  const handleEpisodeParsed = useCallback((next: EpisodeEntry) => {
    setEpisodeData(next);
  }, []);

  const handleSnapshotParsed = useCallback((next: SnapshotConfig) => {
    setSnapshotData(next);
  }, []);

  const { jsonText, setJsonText, lastSyncAt, handleJsonChange, syncJsonFromData } = useTimelineEpisodeJson({
    mode,
    jsonLocked,
    initialJson,
    onDirty: () => setDirty(true),
    onValidation: setValidationErrors,
    onTimelineParsed: handleTimelineParsed,
    onEpisodeParsed: handleEpisodeParsed,
    onSnapshotParsed: handleSnapshotParsed,
  });

  const updateTimeline = useCallback(
    (next: IframeTimeline, { markDirty = true } = {}) => {
      setTimelineData(next);
      syncJsonFromData(next);
      setDirty(Boolean(markDirty));
      setValidationErrors(validateTimeline(next));
    },
    [syncJsonFromData],
  );

  const setEpisodeState = useCallback(
    (next: EpisodeEntry | ((prev: EpisodeEntry) => EpisodeEntry), { markDirty = true } = {}) => {
      setEpisodeData((prev) => {
        const resolved = typeof next === "function" ? (next as (prev: EpisodeEntry) => EpisodeEntry)(prev) : next;
        syncJsonFromData(resolved);
        setDirty(Boolean(markDirty));
        setValidationErrors(validateEpisode(resolved));
        return resolved;
      });
    },
    [syncJsonFromData],
  );

  const updateSnapshot = useCallback(
    (next: SnapshotConfig, { markDirty = true } = {}) => {
      setSnapshotData(next);
      syncJsonFromData(next);
      setDirty(Boolean(markDirty));
      setValidationErrors(validateSnapshot(next));
    },
    [syncJsonFromData],
  );

  const activeData = useMemo(
    () => (mode === "timeline" ? timelineData : mode === "episode" ? episodeData : snapshotData),
    [episodeData, mode, snapshotData, timelineData],
  );

  const {
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
  } = useTimelineEpisodeClipboard({
    mode,
    timelineData,
    episodeData,
    snapshotData,
    updateTimeline,
    setEpisodeState,
    updateSnapshot,
    setMessageForMode,
  });

  const { isSaving, handleSave } = useTimelineEpisodeSave({
    defaultClientId,
    episodeData,
    mode,
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
    onSaved: () => setDirty(false),
  });

  const {
    timelinePlaySrc,
    timelinePlayError,
    handlePlayPreview,
    handlePlayTimelineToClient,
    handlePlayEpisode,
    handlePlaySnapshot,
  } = useTimelineEpisodePlay({
    dirty,
    episodeData,
    episodeTargetOverride,
    handleSave,
    mode,
    setMessageForMode,
    snapshotClient,
    snapshotName,
    timelineData,
  });

  const handleModeChange = useCallback(
    (nextMode: EditorMode) => {
      setMode(nextMode);
      setSelectedRows([]);
      if (nextMode === "timeline") {
        setValidationErrors(validateTimeline(timelineData));
        syncJsonFromData(timelineData);
      } else if (nextMode === "episode") {
        setValidationErrors(validateEpisode(episodeData));
        syncJsonFromData(episodeData);
      } else {
        setValidationErrors(validateSnapshot(snapshotData));
        syncJsonFromData(snapshotData);
      }
    },
    [episodeData, setSelectedRows, snapshotData, syncJsonFromData, timelineData],
  );

  const handleLoadSelected = useCallback(
    async (id: string) => {
      if (!id) return;
      try {
        if (mode === "timeline") {
          const data = await fetchIframeTimeline(id, { resolve: false });
          const payload = (data as { timeline?: unknown }).timeline ?? data;
          updateTimeline(payload as IframeTimeline, { markDirty: false });
          const timelineClient =
            (payload as { clientId?: string; client_id?: string }).clientId || (payload as { client_id?: string }).client_id;
          if (timelineClient) {
            const nextClient = timelineClient;
            setSnapshotClient(nextClient);
            await refreshSnapshots(nextClient);
          }
          setMessageForMode(`已載入 timeline ${id}`, "timeline");
        } else {
          const data = await fetchEpisode(id, { resolve: false });
          const payload = (data as { episode?: EpisodeEntry }).episode || data;
          setEpisodeState(payload as EpisodeEntry, { markDirty: false });
          setMessageForMode(`已載入 episode ${id}`, "episode");
        }
        setDirty(false);
      } catch (err) {
        const errMessage = err instanceof Error ? err.message : "載入失敗";
        setMessageForMode(errMessage, mode);
      }
    },
    [mode, refreshSnapshots, setEpisodeState, setMessageForMode, setSnapshotClient, updateTimeline],
  );

  const handleLoadSnapshot = useCallback(
    async (name: string, clientOverride?: string | null) => {
      const targetClient = clientOverride ?? snapshotClient;
      if (!targetClient) {
        setMessageForMode("請先設定 client 再載入 snapshot", "snapshot");
        return;
      }
      const cleanedName = name.trim();
      if (!cleanedName) return;
      try {
        const data = await getIframeSnapshot(targetClient, cleanedName);
        const raw = (data as { raw?: unknown; snapshot?: unknown }).raw || (data as { snapshot?: unknown }).snapshot || data;
        const resolvedClient = targetClient || (data as { client_id?: string }).client_id || (data as { client?: string }).client;
        setSnapshotClient(resolvedClient || targetClient);
        setSnapshotName(cleanedName);
        updateSnapshot(raw as SnapshotConfig, { markDirty: false });
        setSnapshotPreviewFromConfig(raw as Partial<SnapshotConfig>);
        await refreshSnapshots(resolvedClient || targetClient);
        setMessageForMode(`已載入 snapshot ${resolvedClient || targetClient}/${cleanedName}`, "snapshot");
        setDirty(false);
      } catch (err) {
        const errMessage = err instanceof Error ? err.message : "載入 snapshot 失敗";
        setMessageForMode(errMessage, "snapshot");
      }
    },
    [refreshSnapshots, setMessageForMode, setSnapshotClient, setSnapshotName, snapshotClient, updateSnapshot, setSnapshotPreviewFromConfig],
  );

  const handleStepChange = useCallback(
    (index: number, patch: TimelineStep) => {
      updateTimeline({
        ...timelineData,
        steps: (timelineData.steps || []).map((step, i) => (i === index ? { ...step, ...patch } : step)),
      } as IframeTimeline);
    },
    [timelineData, updateTimeline],
  );

  const handleTrackChange = useCallback(
    (index: number, patch: EpisodeTrack) => {
      setEpisodeState({
        ...episodeData,
        tracks: (episodeData.tracks || []).map((track, i) => (i === index ? { ...track, ...patch } : track)),
      } as EpisodeEntry);
    },
    [episodeData, setEpisodeState],
  );

  const addStep = useCallback(() => {
    updateTimeline({
      ...timelineData,
      steps: [...(timelineData.steps || []), { snapshot: `${defaultClientId}/snapshot_x`, duration: 5, label: "新步驟" }],
    } as IframeTimeline);
  }, [defaultClientId, timelineData, updateTimeline]);

  const addTrack = useCallback(() => {
    const fallbackTimeline =
      timelineList.find(
        (item) =>
          (item.client_id || item.clientId || (item as { client?: string }).client) === defaultClientId ||
          (item.client_id || item.clientId || (item as { client?: string }).client) === snapshotClient,
      ) || timelineList[0];
    setEpisodeState({
      ...episodeData,
      tracks: [
        ...(episodeData.tracks || []),
        { timelineId: fallbackTimeline?.id || "", targetClientId: defaultClientId, offset: 0 } as EpisodeTrack,
      ],
    } as EpisodeEntry);
  }, [defaultClientId, episodeData, setEpisodeState, snapshotClient, timelineList]);

  const addPanel = useCallback(() => {
    const nextPanels = [...(snapshotData.panels || [])];
    const idBase = `panel_${nextPanels.length + 1}`;
    nextPanels.push({ id: idBase, url: "/", ratio: 1, params: {}, label: "" });
    updateSnapshot({ ...snapshotData, panels: nextPanels } as SnapshotConfig);
  }, [snapshotData, updateSnapshot]);

  const handlePanelChange = useCallback(
    (index: number, patch: Partial<SnapshotConfig["panels"][number]>) => {
      updateSnapshot({
        ...snapshotData,
        panels: (snapshotData.panels || []).map((panel, i) => (i === index ? { ...panel, ...patch } : panel)),
      } as SnapshotConfig);
    },
    [snapshotData, updateSnapshot],
  );

  useEffect(() => {
    refreshTimelines();
    refreshEpisodes();
    refreshSnapshots();
  }, [refreshEpisodes, refreshSnapshots, refreshTimelines]);

  useEffect(() => {
    if (mode !== "episode") return;
    if (!timelineList.length) return;
    if (dirty) return;
    setEpisodeState(
      (prev) => {
        if (!prev || !Array.isArray(prev.tracks) || prev.tracks.length === 0) return prev;
        const timelineIds = new Set(timelineList.map((t) => t.id));
        let changed = false;
        const nextTracks = prev.tracks.map((track) => {
          if (!track) return track;
          const currentId = track.timelineId || track.timeline_id || "";
          if (currentId && timelineIds.has(currentId)) return track;
          const targetClient = track.targetClientId || track.target_client_id || "";
          const candidate =
            timelineList.find((item) => (item.client_id || item.clientId || (item as { client?: string }).client) === targetClient) ||
            timelineList[0];
          if (!candidate) return track;
          changed = true;
          return { ...track, timelineId: candidate.id } as EpisodeTrack;
        });
        return changed ? ({ ...prev, tracks: nextTracks } as EpisodeEntry) : prev;
      },
      { markDirty: false },
    );
  }, [dirty, mode, setEpisodeState, timelineList]);

  useEffect(() => {
    const nextTimeline = defaultTimelinePayload(defaultClientId);
    const nextEpisode = defaultEpisodePayload(defaultClientId);
    const nextSnapshot = minimalConfigPayload(defaultClientId);
    setTimelineData(nextTimeline);
    setEpisodeData(nextEpisode);
    setSnapshotData(nextSnapshot);
    setDirty(false);
    if (mode === "timeline") {
      setJsonText(pretty(nextTimeline));
      setValidationErrors(validateTimeline(nextTimeline));
    } else if (mode === "episode") {
      setJsonText(pretty(nextEpisode));
      setValidationErrors(validateEpisode(nextEpisode));
    } else {
      setJsonText(pretty(nextSnapshot));
      setValidationErrors(validateSnapshot(nextSnapshot));
    }
    setSnapshotPreviewFromConfig(nextSnapshot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultClientId]);

  const validationState = validationErrors.length ? "error" : "ok";
  const dataState = isSaving ? "saving" : dirty ? "dirty" : "clean";

  return {
    mode,
    dirty,
    message,
    lastSyncAt,
    jsonLocked,
    jsonReadOnly,
    setJsonLocked,
    setJsonReadOnly,
    dataState,
    validationErrors,
    validationState,
    activeData,
    timelineData,
    episodeData,
    snapshotData,
    setEpisodeState,
    updateTimeline,
    updateSnapshot,
    timelineList,
    episodeList,
    timelineFilter,
    episodeFilter,
    setTimelineFilter,
    setEpisodeFilter,
    refreshTimelines,
    refreshEpisodes,
    refreshSnapshots,
    snapshotClient,
    setSnapshotClient,
    snapshotKeyword,
    setSnapshotKeyword,
    snapshotName,
    setSnapshotName,
    snapshotOptions,
    snapshotMessage,
    selectedRows,
    setSelectedRows,
    batchDuration,
    setBatchDuration,
    batchTargetClient,
    setBatchTargetClient,
    timelinePreviewSrc,
    timelinePreviewError,
    timelinePlaySrc,
    timelinePlayError,
    snapshotPreviewSrc,
    snapshotPreviewError,
    snapshotPreviewWidth,
    snapshotFrameHeight,
    episodeTargetOverride,
    setEpisodeTargetOverride,
    isSaving,
    jsonText,
    handleModeChange,
    handleLoadSelected,
    handleLoadSnapshot,
    handleSave,
    handleJsonChange,
    handleStepChange,
    handleTrackChange,
    handlePanelChange,
    handleCopy,
    handlePaste,
    handleBatchApply,
    handlePlayPreview,
    handlePlayTimelineToClient,
    handlePlayEpisode,
    handlePlaySnapshot,
    addStep,
    addTrack,
    addPanel,
    moveRow,
    duplicateRow,
    removeRow,
    focusRow,
    syncJsonFromData,
    canTimelinePaste,
    canEpisodePaste,
    canSnapshotPaste,
    startSnapshotResize,
  };
}
