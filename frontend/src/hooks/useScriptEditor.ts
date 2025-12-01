import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  createScene,
  createScript,
  enqueueClientQueueItem,
  fetchScene,
  fetchScript,
  getIframeSnapshot,
  listIframeSnapshots,
  listScenes,
  listScripts,
  playScript,
  updateScript,
} from "../api";
import { AdminPanelContext } from "../AdminPanelContext";
import { defaultScriptPayload, previewSrcFromConfig, pretty } from "../adminPanelUtils";
import type { SnapshotEntry } from "../types/admin";
import type { Scene, Script, ScriptEntry } from "../types/scene";
import type { EditorValidationError } from "../utils/adminEditorUtils";
import { validateScript } from "../utils/adminEditorUtils";

export interface ScriptEntryRow {
  type: "scene" | "snapshot_pair";
  scene_id?: string;
  left_snapshot?: string;
  right_snapshot?: string;
  duration: number;
  audio_override?: {
    left?: number;
    right?: number;
    mode?: string;
    muted?: boolean;
  };
  notes?: string;
}

export interface ScriptEntryPreview {
  label: string;
  left?: { snapshot: string; client: string; previewSrc: string | null; error?: string };
  right?: { snapshot: string; client: string; previewSrc: string | null; error?: string };
  sceneTargets?: Array<{ client: string; snapshot: string; previewSrc: string | null; error?: string }>;
  duration?: number;
}

export interface ScriptEditorState {
  scriptData: Script;
  entries: ScriptEntryRow[];
  scenes: Scene[];
  scripts: Script[];
  snapshotOptions: Record<string, SnapshotEntry[]>;
  tagsText: string;
  message: string;
  jsonText: string;
  totalDuration: number;
  validationErrors: EditorValidationError[];
  previewEntries: ScriptEntryPreview[];
  isSaving: boolean;
  isPreviewing: boolean;
  isPlaying: boolean;
  isEnqueuing: boolean;
  queueClientId: string;
}

export interface ScriptEditorHandlers {
  reloadScenes: () => Promise<void>;
  reloadScripts: () => Promise<void>;
  loadScript: (id: string) => Promise<void>;
  applyDefault: () => void;
  refreshSnapshotsForClient: (client: string) => Promise<void>;
  setScriptField: (field: keyof Script, value: unknown) => void;
  setTagsText: (value: string) => void;
  setEntryField: (index: number, field: keyof ScriptEntryRow, value: unknown) => void;
  setEntryAudioField: (index: number, field: "left" | "right" | "mode" | "muted", value: string | boolean) => void;
  addEntry: () => void;
  removeEntry: (index: number) => void;
  duplicateEntry: (index: number) => void;
  moveEntry: (from: number, to: number) => void;
  validateAndPreview: () => Promise<void>;
  saveScript: () => Promise<void>;
  playCurrentScript: () => Promise<void>;
  enqueueScript: () => Promise<void>;
  setQueueClientId: (value: string) => void;
}

function parseSnapshotRef(ref: string): { client: string; name: string } {
  const snapshot = (ref || "").trim();
  if (!snapshot) {
    throw new Error("snapshot 參考不可為空白");
  }
  if (!snapshot.includes("/")) {
    throw new Error("snapshot 需要 client/name");
  }
  const [client, name] = snapshot.split("/", 2).map((s) => s.trim());
  if (!client || !name) {
    throw new Error("snapshot 需要 client/name");
  }
  return { client, name };
}

function normalizeScriptPayload(payload: Partial<Script>): Script {
  const entries = Array.isArray(payload.entries) ? payload.entries : [];
  return {
    id: (payload.id as string) || "",
    title: (payload.title as string) || "",
    entries,
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    description: (payload.description as string) || "",
    notes: (payload.notes as string) || "",
  };
}

function entriesFromPayload(entries: ScriptEntry[] | undefined, defaultDuration = 5): ScriptEntryRow[] {
  if (!Array.isArray(entries) || entries.length === 0) {
    return [
      {
        type: "scene",
        scene_id: "",
        duration: defaultDuration,
      },
    ];
  }
  return entries.map((entry) => ({
    type: entry.type as "scene" | "snapshot_pair",
    scene_id: entry.scene_id || (entry as { sceneId?: string }).sceneId,
    left_snapshot: entry.left_snapshot || (entry as { leftSnapshot?: string }).leftSnapshot,
    right_snapshot: entry.right_snapshot || (entry as { rightSnapshot?: string }).rightSnapshot,
    duration: entry.duration ?? defaultDuration,
    audio_override: entry.audio_override || (entry as { audioOverride?: ScriptEntryRow["audio_override"] }).audioOverride,
    notes: entry.notes,
  }));
}

function buildEntriesPayload(entries: ScriptEntryRow[]): ScriptEntry[] {
  return entries.map((entry) => {
    const base: ScriptEntry = {
      type: entry.type,
      duration: Number(entry.duration) || 0,
      notes: entry.notes,
    };
    if (entry.type === "scene") {
      base.scene_id = (entry.scene_id || "").trim();
      base.left_snapshot = undefined;
      base.right_snapshot = undefined;
    } else {
      base.scene_id = undefined;
      base.left_snapshot = (entry.left_snapshot || "").trim() || undefined;
      base.right_snapshot = (entry.right_snapshot || "").trim() || undefined;
    }
    if (entry.audio_override) {
      const mix = entry.audio_override;
      base.audio_override = {
        left: mix.left ?? undefined,
        right: mix.right ?? undefined,
        mode: mix.mode?.trim() || undefined,
        muted: mix.muted ?? undefined,
      };
    }
    return base;
  });
}

export default function useScriptEditor(): [ScriptEditorState, ScriptEditorHandlers] {
  const { defaultClientId } = useContext(AdminPanelContext);
  const defaultPayload = useMemo(() => defaultScriptPayload(defaultClientId), [defaultClientId]);

  const [scriptData, setScriptData] = useState<Script>(() => normalizeScriptPayload(defaultPayload as Script));
  const [entries, setEntries] = useState<ScriptEntryRow[]>(() =>
    entriesFromPayload((defaultPayload as Script).entries as ScriptEntry[]),
  );
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [snapshotOptions, setSnapshotOptions] = useState<Record<string, SnapshotEntry[]>>({});
  const [tagsText, setTagsText] = useState<string>(() => Array.isArray((defaultPayload as Script).tags) ? (defaultPayload as Script).tags.join(", ") : "");
  const [message, setMessage] = useState("");
  const [jsonText, setJsonText] = useState(() => pretty(defaultPayload));
  const [totalDuration, setTotalDuration] = useState<number>(() => entries.reduce((sum, e) => sum + (Number(e.duration) || 0), 0));
  const [validationErrors, setValidationErrors] = useState<EditorValidationError[]>(() => validateScript(defaultPayload as Script));
  const [previewEntries, setPreviewEntries] = useState<ScriptEntryPreview[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isEnqueuing, setIsEnqueuing] = useState(false);
  const [queueClientId, setQueueClientId] = useState<string>(defaultClientId || "");

  const syncJson = useCallback(
    (payload?: Script) => {
      const target = payload || {
        ...scriptData,
        entries: buildEntriesPayload(entries),
        tags: tagsText
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      };
      setJsonText(pretty(target));
    },
    [entries, scriptData, tagsText],
  );

  const refreshSnapshotsForClients = useCallback(
    async (clients: string[]) => {
      const unique = Array.from(new Set(clients.filter(Boolean)));
      if (!unique.length) return;
      const results: Record<string, SnapshotEntry[]> = {};
      await Promise.all(
        unique.map(async (client) => {
          try {
            const data = await listIframeSnapshots(client);
            results[client] = Array.isArray(data.snapshots) ? (data.snapshots as SnapshotEntry[]) : [];
          } catch (err) {
            results[client] = [];
            setMessage((prev) => prev || (err instanceof Error ? err.message : "載入 snapshot 失敗"));
          }
        }),
      );
      setSnapshotOptions((prev) => ({ ...prev, ...results }));
    },
    [],
  );

  const refreshSnapshotsForClient = useCallback(
    async (client: string) => {
      if (!client) return;
      await refreshSnapshotsForClients([client]);
    },
    [refreshSnapshotsForClients],
  );

  const reloadScenes = useCallback(async () => {
    try {
      const data = await listScenes();
      const list = Array.isArray(data.scenes) ? (data.scenes as Scene[]) : [];
      setScenes(list);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "載入 scenes 失敗");
    }
  }, []);

  const reloadScripts = useCallback(async () => {
    try {
      const data = await listScripts();
      const list = Array.isArray(data.scripts) ? (data.scripts as Script[]) : [];
      setScripts(list);
      setMessage(`已載入 ${list.length} 筆 script`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "載入 scripts 失敗");
    }
  }, []);

  const syncFromPayload = useCallback(
    (payload: Partial<Script>) => {
      const normalized = normalizeScriptPayload(payload);
      const nextEntries = entriesFromPayload(normalized.entries as ScriptEntry[]);
      setScriptData(normalized);
      setEntries(nextEntries);
      setTagsText(Array.isArray(normalized.tags) ? normalized.tags.join(", ") : "");
      setValidationErrors(validateScript({ ...normalized, entries: buildEntriesPayload(nextEntries) }));
      setPreviewEntries([]);
      setMessage("");
      setQueueClientId((prev) => prev || defaultClientId || "");
      setTotalDuration(nextEntries.reduce((sum, e) => sum + (Number(e.duration) || 0), 0));
      syncJson(normalized);
      const clients = nextEntries
        .map((e) => [e.left_snapshot, e.right_snapshot])
        .flat()
        .filter(Boolean)
        .map((ref) => {
          try {
            return parseSnapshotRef(ref as string).client;
          } catch (err) {
            return null;
          }
        })
        .filter(Boolean) as string[];
      void refreshSnapshotsForClients(clients);
    },
    [defaultClientId, refreshSnapshotsForClients, syncJson],
  );

  const loadScript = useCallback(
    async (id: string) => {
      if (!id) return;
      try {
        const data = await fetchScript(id, { resolve: false });
        const payload = (data as { script?: Script }).script || data;
        syncFromPayload(payload as Script);
        setMessage(`已載入 script ${id}`);
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "載入 script 失敗");
      }
    },
    [syncFromPayload],
  );

  const applyDefault = useCallback(() => {
    syncFromPayload(defaultScriptPayload(defaultClientId) as Script);
    setMessage("已套用預設 Script");
  }, [defaultClientId, syncFromPayload]);

  const setScriptField = useCallback((field: keyof Script, value: unknown) => {
    setScriptData((prev) => ({ ...prev, [field]: value as never }));
  }, []);

  const setEntryField = useCallback((index: number, field: keyof ScriptEntryRow, value: unknown) => {
    setEntries((prev) =>
      prev.map((row, idx) => {
        if (idx !== index) return row;
        return { ...row, [field]: value as never };
      }),
    );
  }, []);

  const setEntryAudioField = useCallback((index: number, field: "left" | "right" | "mode" | "muted", value: string | boolean) => {
    setEntries((prev) =>
      prev.map((row, idx) => {
        if (idx !== index) return row;
        const audio = { ...(row.audio_override || {}) };
        if (field === "muted") {
          audio.muted = Boolean(value);
        } else if (field === "mode") {
          audio.mode = typeof value === "string" ? value : "";
        } else {
          const text = typeof value === "string" ? value.trim() : "";
          if (text === "") {
            audio[field] = undefined;
          } else {
            const num = Number(value);
            audio[field] = Number.isNaN(num) ? undefined : num;
          }
        }
        return { ...row, audio_override: audio };
      }),
    );
  }, []);

  const addEntry = useCallback(() => {
    setEntries((prev) => [...prev, { type: "scene", scene_id: "", duration: 5 }]);
  }, []);

  const removeEntry = useCallback((index: number) => {
    setEntries((prev) => prev.filter((_, idx) => idx !== index));
  }, []);

  const duplicateEntry = useCallback((index: number) => {
    setEntries((prev) => {
      const target = prev[index];
      if (!target) return prev;
      return [...prev.slice(0, index + 1), { ...target }, ...prev.slice(index + 1)];
    });
  }, []);

  const moveEntry = useCallback((from: number, to: number) => {
    setEntries((prev) => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }, []);

  const buildPayload = useCallback((): Script => {
    const tags = tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const payload: Script = {
      ...scriptData,
      id: (scriptData.id || "").trim(),
      entries: buildEntriesPayload(entries),
      tags,
    };
    return payload;
  }, [entries, scriptData, tagsText]);

  const validateAndPreview = useCallback(async () => {
    const payload = buildPayload();
    const errors = validateScript(payload);
    setValidationErrors(errors);
    if (errors.length) {
      setMessage("請先修正表單錯誤");
      return;
    }
    setIsPreviewing(true);
    try {
      const previewList: ScriptEntryPreview[] = [];
      for (const [index, entry] of payload.entries.entries()) {
        const preview: ScriptEntryPreview = { label: `Entry ${index + 1} (${entry.type})`, duration: entry.duration };
        if (entry.type === "scene" && entry.scene_id) {
          try {
            const sceneData = await fetchScene(entry.scene_id, { resolve: true });
            const resolvedScene = (sceneData as { scene?: { targets?: Array<{ client_id?: string; snapshot?: string; config?: unknown }> } }).scene;
            if (resolvedScene && Array.isArray(resolvedScene.targets)) {
              preview.sceneTargets = resolvedScene.targets.slice(0, 2).map((target, idx) => {
                const client = (target as { client_id?: string }).client_id || `scene-target-${idx + 1}`;
                const snap = (target as { snapshot?: string }).snapshot || "";
                const config = (target as { config?: unknown }).config;
                let src: string | null = null;
                try {
                  src = previewSrcFromConfig(config as Record<string, unknown>);
                } catch (err) {
                  src = null;
                }
                return { client, snapshot: snap, previewSrc: src || null };
              });
            }
          } catch (err) {
            preview.sceneTargets = [{ client: entry.scene_id, snapshot: "解析失敗", previewSrc: null, error: err instanceof Error ? err.message : "解析失敗" }];
          }
        } else {
          const left = entry.left_snapshot;
          const right = entry.right_snapshot;
          const handleSide = async (ref?: string | null) => {
            if (!ref) return undefined;
            try {
              const { client, name } = parseSnapshotRef(ref);
              const data = await getIframeSnapshot(client, name);
              const raw =
                (data as { raw?: unknown }).raw ??
                (data as { snapshot?: unknown }).snapshot ??
                (data as { config?: unknown }).config ??
                data;
              const src = previewSrcFromConfig(raw as Record<string, unknown>);
              return { client, snapshot: `${client}/${name}`, previewSrc: src || null };
            } catch (err) {
              return { client: "?", snapshot: ref || "", previewSrc: null, error: err instanceof Error ? err.message : "解析失敗" };
            }
          };
          preview.left = await handleSide(left);
          preview.right = await handleSide(right);
        }
        previewList.push(preview);
      }
      setPreviewEntries(previewList);
      setMessage("解析完成");
    } finally {
      setIsPreviewing(false);
    }
  }, [buildPayload]);

  const saveScript = useCallback(async () => {
    const payload = buildPayload();
    const errors = validateScript(payload);
    setValidationErrors(errors);
    if (errors.length) {
      setMessage("請先修正表單錯誤再儲存");
      return;
    }
    setIsSaving(true);
    try {
      const exists = scripts.some((item) => item.id === payload.id);
      const resp = exists ? await updateScript(payload.id, payload) : await createScript(payload);
      const saved = (resp as { script?: Script }).script || (resp as Script);
      syncFromPayload(saved);
      await reloadScripts();
      setMessage(exists ? "已更新 script" : "已建立 script");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "儲存失敗");
    } finally {
      setIsSaving(false);
    }
  }, [buildPayload, reloadScripts, scripts, syncFromPayload]);

  const playCurrentScript = useCallback(async () => {
    const targetId = (scriptData.id || "").trim();
    if (!targetId) {
      setMessage("請先指定 script id");
      return;
    }
    setIsPlaying(true);
    try {
      await playScript(targetId, {});
      setMessage("已送出播放");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "播放失敗");
    } finally {
      setIsPlaying(false);
    }
  }, [scriptData.id]);

  const enqueueScript = useCallback(async () => {
    const targetId = (scriptData.id || "").trim();
    if (!targetId) {
      setMessage("請先指定 script id");
      return;
    }
    if (!queueClientId) {
      setMessage("請提供 queue client id");
      return;
    }
    setIsEnqueuing(true);
    try {
      await enqueueClientQueueItem({
        client_id: queueClientId,
        type: "script",
        target_id: targetId,
        payload: {},
      });
      setMessage(`已送出 queue 到 ${queueClientId}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "排程失敗");
    } finally {
      setIsEnqueuing(false);
    }
  }, [queueClientId, scriptData.id]);

  useEffect(() => {
    const duration = entries.reduce((sum, e) => sum + (Number(e.duration) || 0), 0);
    setTotalDuration(duration);
    syncJson();
    setValidationErrors(validateScript({ ...scriptData, entries: buildEntriesPayload(entries) }));
  }, [entries, scriptData, syncJson]);

  useEffect(() => {
    void reloadScripts();
    void reloadScenes();
  }, [reloadScenes, reloadScripts]);

  return [
    {
      scriptData,
      entries,
      scenes,
      scripts,
      snapshotOptions,
      tagsText,
      message,
      jsonText,
      totalDuration,
      validationErrors,
      previewEntries,
      isSaving,
      isPreviewing,
      isPlaying,
      isEnqueuing,
      queueClientId,
    },
    {
      reloadScenes,
      reloadScripts,
      loadScript,
      applyDefault,
      refreshSnapshotsForClient,
      setScriptField,
      setTagsText,
      setEntryField,
      setEntryAudioField,
      addEntry,
      removeEntry,
      duplicateEntry,
      moveEntry,
      validateAndPreview,
      saveScript,
      playCurrentScript,
      enqueueScript,
      setQueueClientId,
    },
  ];
}
