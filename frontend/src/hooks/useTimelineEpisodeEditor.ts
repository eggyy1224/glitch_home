import type React from "react";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  createEpisode,
  createIframeTimeline,
  fetchEpisode,
  fetchIframeTimeline,
  getIframeSnapshot,
  listEpisodes,
  listIframeSnapshots,
  listIframeTimelines,
  playEpisode,
  playIframeTimeline,
  restoreIframeSnapshot,
  saveIframeSnapshot,
  updateEpisode as updateEpisodeApi,
  updateIframeTimeline,
} from "../api";
import { AdminPanelContext } from "../AdminPanelContext";
import {
  defaultEpisodePayload,
  defaultTimelinePayload,
  firstSnapshotRef,
  minimalConfigPayload,
  parseTargetMap,
  previewSrcFromConfig,
  pretty,
  timelinePlaybackSrc,
} from "../adminPanelUtils";
import type { IframePanelConfig } from "../types/control";
import type { SnapshotConfig, SnapshotPanel } from "../types/admin";
import type { EpisodeEntry, EpisodeTrack, IframeTimeline, SnapshotEntry, TimelineStep } from "../types/timeline";
import type { EditorMode, EditorValidationError } from "../utils/adminEditorUtils";
import { validateEpisode, validateSnapshot, validateTimeline } from "../utils/adminEditorUtils";

interface ClipboardState {
  mode: EditorMode;
  items: Array<Record<string, unknown>>;
}

type SnapshotOption = SnapshotEntry & { id?: string; client: string };

export default function useTimelineEpisodeEditor() {
  const { defaultClientId } = useContext(AdminPanelContext);
  const [mode, setMode] = useState<EditorMode>("timeline");
  const [timelineData, setTimelineData] = useState<IframeTimeline>(() => defaultTimelinePayload(defaultClientId));
  const [episodeData, setEpisodeData] = useState<EpisodeEntry>(() => defaultEpisodePayload(defaultClientId));
  const [snapshotData, setSnapshotData] = useState<SnapshotConfig>(() => minimalConfigPayload(defaultClientId));
  const [jsonText, setJsonText] = useState(() => pretty(defaultTimelinePayload(defaultClientId)));
  const [jsonLocked, setJsonLocked] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [dirty, setDirty] = useState(false);
  const [validationErrors, setValidationErrors] = useState<EditorValidationError[]>([]);
  const [message, setMessage] = useState("");
  const [messageByMode, setMessageByMode] = useState<Record<EditorMode, string>>({
    timeline: "",
    episode: "",
    snapshot: "",
  });
  const [timelineList, setTimelineList] = useState<IframeTimeline[]>([]);
  const [episodeList, setEpisodeList] = useState<EpisodeEntry[]>([]);
  const [timelineFilter, setTimelineFilter] = useState("");
  const [episodeFilter, setEpisodeFilter] = useState("");
  const [snapshotClient, setSnapshotClient] = useState(defaultClientId);
  const [snapshotKeyword, setSnapshotKeyword] = useState("");
  const [snapshotName, setSnapshotName] = useState("new_snapshot");
  const [snapshotOptions, setSnapshotOptions] = useState<SnapshotOption[]>([]);
  const [snapshotMessage, setSnapshotMessage] = useState("");
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [clipboard, setClipboard] = useState<ClipboardState | null>(null);
  const [batchDuration, setBatchDuration] = useState("");
  const [batchTargetClient, setBatchTargetClient] = useState("");
  const [timelinePreviewSrc, setTimelinePreviewSrc] = useState<string | null>(null);
  const [timelinePreviewError, setTimelinePreviewError] = useState<string | null>(null);
  const [timelinePlaySrc, setTimelinePlaySrc] = useState<string | null>(null);
  const [timelinePlayError, setTimelinePlayError] = useState<string | null>(null);
  const [snapshotPreviewSrc, setSnapshotPreviewSrc] = useState<string | null>(null);
  const [snapshotPreviewError, setSnapshotPreviewError] = useState<string | null>(null);
  const [snapshotPreviewWidth, setSnapshotPreviewWidth] = useState<number>(() => {
    if (typeof window === "undefined") return 960;
    return Math.max(Math.min(window.innerWidth - 100, 1200), 720);
  });
  const [episodeTargetOverride, setEpisodeTargetOverride] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [jsonReadOnly, setJsonReadOnly] = useState(false);

  const activeData = useMemo(
    () => (mode === "timeline" ? timelineData : mode === "episode" ? episodeData : snapshotData),
    [episodeData, mode, snapshotData, timelineData],
  );
  const snapshotFrameHeight = useMemo(
    () => Math.max(320, Math.round((snapshotPreviewWidth * 9) / 16)),
    [snapshotPreviewWidth],
  );

  const setMessageForMode = useCallback(
    (value: string, targetMode: EditorMode = mode) => {
      setMessageByMode((prev) => {
        const current = prev[targetMode];
        if (current === value) return prev;
        return { ...prev, [targetMode]: value };
      });
      if (targetMode === mode) {
        setMessage((prev) => (prev === value ? prev : value));
      }
    },
    [mode],
  );

  useEffect(() => {
    const next = messageByMode[mode] || "";
    setMessage((prev) => (prev === next ? prev : next));
  }, [messageByMode, mode]);

  const syncJsonFromData = useCallback(
    (data: unknown) => {
      if (jsonLocked) return;
      setJsonText(pretty(data));
      setLastSyncAt(new Date());
    },
    [jsonLocked],
  );

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

  const handleModeChange = useCallback(
    (nextMode: EditorMode) => {
      setMode(nextMode);
      const savedMessage = messageByMode[nextMode] || "";
      setMessage((prev) => (prev === savedMessage ? prev : savedMessage));
      setSelectedRows([]);
      setTimelinePlaySrc(null);
      setTimelinePlayError(null);
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
    [episodeData, messageByMode, snapshotData, syncJsonFromData, timelineData],
  );

  const refreshTimelines = useCallback(async () => {
    try {
      const data = await listIframeTimelines(timelineFilter || null);
      const list = Array.isArray(data.timelines) ? data.timelines : [];
      setTimelineList(list as IframeTimeline[]);
      setMessageForMode(`已載入 ${data.timelines?.length ?? 0} 筆 timeline`, "timeline");
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : "載入 timeline 失敗";
      setMessageForMode(errMessage, "timeline");
    }
  }, [setMessageForMode, timelineFilter]);

  const refreshEpisodes = useCallback(async () => {
    try {
      const data = await listEpisodes();
      const list = Array.isArray(data.episodes) ? data.episodes : [];
      const filtered = episodeFilter ? list.filter((e) => `${e.id}`.includes(episodeFilter)) : list;
      setEpisodeList(filtered as EpisodeEntry[]);
      setMessageForMode(`已載入 ${filtered.length} 筆 episode`, "episode");
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : "載入 episode 失敗";
      setMessageForMode(errMessage, "episode");
    }
  }, [episodeFilter, setMessageForMode]);

  const refreshSnapshots = useCallback(
    async (clientOverride?: string | null) => {
      try {
        const targetClient = clientOverride ?? snapshotClient;
        const data = await listIframeSnapshots(targetClient || null);
        const list = Array.isArray(data.snapshots) ? data.snapshots : [];
        const filtered = snapshotKeyword
          ? list.filter(
              (item) => `${item.id || item.name}`.includes(snapshotKeyword) || `${item.client}`.includes(snapshotKeyword),
            )
          : list;
        const normalized: SnapshotOption[] = filtered.map((item) => ({
          ...(item as SnapshotEntry),
          client: item.client || (item as { client_id?: string }).client_id || targetClient || "",
        }));
        setSnapshotOptions(normalized);
        setSnapshotMessage(`取得 ${filtered.length} 筆 snapshot`);
        setMessageForMode(`取得 ${filtered.length} 筆 snapshot`, "snapshot");
      } catch (err) {
        const errMessage = err instanceof Error ? err.message : "載入 snapshot 清單失敗";
        setSnapshotMessage(errMessage);
        setMessageForMode(errMessage, "snapshot");
      }
    },
    [setMessageForMode, snapshotClient, snapshotKeyword],
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
            (payload as { clientId?: string; client_id?: string }).clientId ||
            (payload as { client_id?: string }).client_id;
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
    [mode, refreshSnapshots, setEpisodeState, setMessageForMode, updateTimeline],
  );

  const handleLoadSnapshot = useCallback(
    async (name: string, clientOverride?: string | null) => {
      const targetClient = clientOverride ?? snapshotClient;
      if (!targetClient) {
        setMessageForMode("請先設定 client 再載入 snapshot", "snapshot");
        return;
      }
      if (!name) return;
      try {
        const data = await getIframeSnapshot(targetClient, name);
        const raw = (data as { raw?: unknown; snapshot?: unknown }).raw || (data as { snapshot?: unknown }).snapshot || data;
        const resolvedClient = targetClient || (data as { client_id?: string }).client_id || (data as { client?: string }).client;
        setSnapshotClient(resolvedClient || targetClient);
        setSnapshotName(name);
        updateSnapshot(raw as SnapshotConfig, { markDirty: false });
        const src = previewSrcFromConfig(raw as Partial<SnapshotConfig>);
        setSnapshotPreviewSrc(src);
        setSnapshotPreviewError(src ? null : "預覽來源不足");
        await refreshSnapshots(resolvedClient || targetClient);
        setMessageForMode(`已載入 snapshot ${resolvedClient || targetClient}/${name}`, "snapshot");
        setDirty(false);
      } catch (err) {
        const errMessage = err instanceof Error ? err.message : "載入 snapshot 失敗";
        setMessageForMode(errMessage, "snapshot");
      }
    },
    [refreshSnapshots, setMessageForMode, snapshotClient, updateSnapshot],
  );

  const clampSnapshotPreviewWidth = useCallback((width: number) => {
    const max = typeof window !== "undefined" ? Math.max(window.innerWidth - 60, 640) : 1400;
    return Math.min(Math.max(width, 560), Math.min(max, 1800));
  }, []);

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
      setDirty(false);
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
    refreshEpisodes,
    refreshSnapshots,
    refreshTimelines,
    setEpisodeState,
    setMessageForMode,
    snapshotClient,
    snapshotData,
    snapshotName,
    timelineData,
    updateSnapshot,
    updateTimeline,
  ]);

  const handleJsonChange = useCallback((text: string) => {
    setJsonText(text);
    setDirty(true);
  }, []);

  const focusRow = useCallback((index: number) => {
    setSelectedRows([index]);
  }, []);

  useEffect(() => {
    if (jsonLocked) return undefined;
    const handle = setTimeout(() => {
      try {
        const parsed = JSON.parse(jsonText);
        if (mode === "timeline") {
          setTimelineData(parsed as IframeTimeline);
          setValidationErrors(validateTimeline(parsed as Partial<IframeTimeline>));
        } else if (mode === "episode") {
          setEpisodeData(parsed as EpisodeEntry);
          setValidationErrors(validateEpisode(parsed as Partial<EpisodeEntry>));
        } else {
          setSnapshotData(parsed as SnapshotConfig);
          setValidationErrors(validateSnapshot(parsed as Partial<SnapshotConfig>));
        }
        setLastSyncAt(new Date());
      } catch (err) {
        const errMessage = err instanceof Error ? err.message : "JSON 解析失敗";
        setValidationErrors([{ path: "json", message: errMessage }]);
      }
    }, 500);
    return () => clearTimeout(handle);
  }, [jsonLocked, jsonText, mode]);

  useEffect(() => {
    const nextTimeline = defaultTimelinePayload(defaultClientId);
    const nextEpisode = defaultEpisodePayload(defaultClientId);
    const nextSnapshot = minimalConfigPayload(defaultClientId);
    setTimelineData(nextTimeline);
    setEpisodeData(nextEpisode);
    setSnapshotData(nextSnapshot);
    setSnapshotClient(defaultClientId);
    setSnapshotName("new_snapshot");
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
    // 只在 defaultClientId 變更時重置，避免切換模式時清空編輯中的資料
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultClientId]);

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
    try {
      const src = previewSrcFromConfig(snapshotData);
      setSnapshotPreviewSrc(src);
      setSnapshotPreviewError(src ? null : "預覽來源不足");
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : "預覽取得失敗";
      setSnapshotPreviewSrc(null);
      setSnapshotPreviewError(errMessage);
    }
  }, [mode, snapshotData]);

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
    (index: number, patch: Partial<SnapshotPanel>) => {
      updateSnapshot({
        ...snapshotData,
        panels: (snapshotData.panels || []).map((panel, i) => (i === index ? { ...panel, ...patch } : panel)),
      } as SnapshotConfig);
    },
    [snapshotData, updateSnapshot],
  );

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
    [episodeData, mode, snapshotData, timelineData, setEpisodeState, updateSnapshot, updateTimeline],
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
      const targetClientId =
        timelineData.clientId ?? (timelineData as { client_id?: string | null }).client_id ?? null;
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

  const canTimelinePaste = Boolean(clipboard && clipboard.mode === "timeline");
  const canEpisodePaste = Boolean(clipboard && clipboard.mode === "episode");
  const canSnapshotPaste = Boolean(clipboard && clipboard.mode === "snapshot");
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
