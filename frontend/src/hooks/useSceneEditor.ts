import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  createScene,
  enqueueClientQueueItem,
  fetchScene,
  getIframeSnapshot,
  listIframeSnapshots,
  listScenes,
  playScene,
  updateScene,
} from "../api";
import { AdminPanelContext } from "../AdminPanelContext";
import { defaultScenePayload, previewSrcFromConfig, pretty } from "../adminPanelUtils";
import type { Scene } from "../types/scene";
import type { SnapshotEntry } from "../types/admin";
import type { EditorValidationError } from "../utils/adminEditorUtils";
import { validateScene } from "../utils/adminEditorUtils";

export interface SceneTargetRow {
  client: string;
  snapshot: string;
}

export interface ScenePreviewEntry {
  client: string;
  snapshot: string;
  previewSrc: string | null;
  error?: string;
}

export interface SceneEditorState {
  sceneData: Scene;
  tagsText: string;
  targets: SceneTargetRow[];
  sceneList: Scene[];
  validationErrors: EditorValidationError[];
  previewEntries: ScenePreviewEntry[];
  jsonText: string;
  message: string;
  snapshotOptions: Record<string, SnapshotEntry[]>;
  isSaving: boolean;
  isPreviewing: boolean;
  isPlaying: boolean;
  isEnqueuing: boolean;
  queueClientId: string;
}

export interface SceneEditorHandlers {
  reloadScenes: () => Promise<void>;
  loadScene: (id: string) => Promise<void>;
  applyDefault: () => void;
  refreshSnapshotsForClient: (client: string) => Promise<void>;
  setSceneField: (field: keyof Scene, value: unknown) => void;
  setTagsText: (value: string) => void;
  setTargets: (updater: SceneTargetRow[] | ((prev: SceneTargetRow[]) => SceneTargetRow[])) => void;
  addTarget: () => void;
  removeTarget: (index: number) => void;
  setTargetField: (index: number, field: keyof SceneTargetRow, value: string) => void;
  validateAndPreview: () => Promise<void>;
  saveScene: () => Promise<void>;
  playCurrentScene: () => Promise<void>;
  enqueueScene: () => Promise<void>;
  setQueueClientId: (value: string) => void;
}

export function parseSnapshotRef(ref: string, defaultClient?: string | null): { client: string; name: string } {
  const snapshot = (ref || "").trim();
  const baseClient = (defaultClient || "").trim();
  if (!snapshot) {
    throw new Error("snapshot 參考不可為空白");
  }
  if (snapshot.includes("/")) {
    const [clientPart, namePart] = snapshot.split("/", 2).map((s) => s.trim());
    if (!namePart) {
      throw new Error("snapshot 名稱不可為空白");
    }
    return { client: clientPart || baseClient || "", name: namePart };
  }
  if (!baseClient) {
    throw new Error("snapshot 參考缺少 client_id");
  }
  return { client: baseClient, name: snapshot };
}

function toTagsText(tags?: string[] | null): string {
  if (!tags || !Array.isArray(tags)) return "";
  return tags.join(", ");
}

function normalizeScenePayload(payload: Partial<Scene>, defaultClient: string): Scene {
  const tags = Array.isArray(payload.tags) ? payload.tags : [];
  const normalized: Scene = {
    id: (payload.id as string) || "",
    title: (payload.title as string) || "",
    targets: (payload.targets as Record<string, string>) || { [defaultClient]: `${defaultClient}/snapshot_a` },
    audio_mix: payload.audio_mix,
    tags,
    description: (payload.description as string) || "",
    notes: (payload.notes as string) || "",
  };
  return normalized;
}

function targetsFromRecord(record: Record<string, string> | undefined | null, fallbackClient: string): SceneTargetRow[] {
  if (!record || typeof record !== "object") {
    return [{ client: fallbackClient, snapshot: "" }];
  }
  const entries: SceneTargetRow[] = [];
  Object.entries(record).forEach(([client, ref]) => {
    entries.push({ client: (client || "").trim(), snapshot: String(ref ?? "").trim() });
  });
  return entries.length ? entries : [{ client: fallbackClient, snapshot: "" }];
}

function buildTargetsRecord(targets: SceneTargetRow[]): Record<string, string> {
  const record: Record<string, string> = {};
  targets.forEach((row) => {
    const snapshot = (row.snapshot || "").trim();
    if (!snapshot) return;
    let client = (row.client || "").trim();
    if (!client && snapshot.includes("/")) {
      try {
        const parsed = parseSnapshotRef(snapshot, "");
        client = parsed.client;
      } catch (err) {
        // skip malformed snapshot without client
        client = "";
      }
    }
    if (!client) return;
    record[client] = snapshot;
  });
  return record;
}

export default function useSceneEditor(): [SceneEditorState, SceneEditorHandlers] {
  const { defaultClientId } = useContext(AdminPanelContext);
  const defaultPayload = useMemo(() => defaultScenePayload(defaultClientId), [defaultClientId]);

  const [sceneData, setSceneData] = useState<Scene>(() => normalizeScenePayload(defaultPayload as Scene, defaultClientId));
  const [tagsText, setTagsText] = useState<string>(() => toTagsText((defaultPayload as Scene).tags));
  const [targets, setTargets] = useState<SceneTargetRow[]>(() =>
    targetsFromRecord((defaultPayload as Scene).targets as Record<string, string>, defaultClientId),
  );
  const [sceneList, setSceneList] = useState<Scene[]>([]);
  const [validationErrors, setValidationErrors] = useState<EditorValidationError[]>(() => validateScene(defaultPayload as Scene));
  const [previewEntries, setPreviewEntries] = useState<ScenePreviewEntry[]>([]);
  const [jsonText, setJsonText] = useState(() => pretty(defaultPayload));
  const [message, setMessage] = useState("");
  const [snapshotOptions, setSnapshotOptions] = useState<Record<string, SnapshotEntry[]>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isEnqueuing, setIsEnqueuing] = useState(false);
  const [queueClientId, setQueueClientId] = useState<string>(defaultClientId || "");

  const syncJson = useCallback(
    (payload?: Scene) => {
      setJsonText(pretty(payload || { ...sceneData, targets: buildTargetsRecord(targets), tags: tagsText.split(",") }));
    },
    [sceneData, tagsText, targets],
  );

  const buildPayload = useCallback((): Scene => {
    const tags = tagsText
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const payload: Scene = {
      ...sceneData,
      id: (sceneData.id || "").trim(),
      targets: buildTargetsRecord(targets),
      tags,
    };
    if (payload.audio_mix) {
      const { audio_mix } = payload;
      payload.audio_mix = {
        left: audio_mix.left ?? undefined,
        right: audio_mix.right ?? undefined,
        mode: audio_mix.mode?.trim() || undefined,
        muted: audio_mix.muted ?? undefined,
      };
    }
    return payload;
  }, [sceneData, tagsText, targets]);

  const refreshSnapshotsForClients = useCallback(
    async (clients: string[]) => {
      const unique = Array.from(new Set(clients.filter(Boolean)));
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

  const syncFromPayload = useCallback(
    (payload: Partial<Scene>) => {
      const normalized = normalizeScenePayload(payload, defaultClientId);
      setSceneData(normalized);
      setTagsText(toTagsText(normalized.tags));
      const nextTargets = targetsFromRecord(normalized.targets as Record<string, string>, defaultClientId);
      setTargets(nextTargets);
      setValidationErrors(validateScene(normalized));
      setPreviewEntries([]);
      setMessage("");
      setQueueClientId((prev) => prev || defaultClientId || "");
      syncJson(normalized);
      void refreshSnapshotsForClients(nextTargets.map((t) => t.client));
    },
    [defaultClientId, refreshSnapshotsForClients, syncJson],
  );

  const reloadScenes = useCallback(async () => {
    try {
      const data = await listScenes();
      const list = Array.isArray(data.scenes) ? (data.scenes as Scene[]) : [];
      setSceneList(list);
      setMessage(`已載入 ${list.length} 筆 scene`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "載入 scene 失敗");
    }
  }, []);

  const loadScene = useCallback(
    async (id: string) => {
      if (!id) return;
      try {
        const data = await fetchScene(id, { resolve: false });
        const payload = (data as { scene?: Scene }).scene || data;
        syncFromPayload(payload as Scene);
        setMessage(`已載入 scene ${id}`);
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "載入 scene 失敗");
      }
    },
    [syncFromPayload],
  );

  const applyDefault = useCallback(() => {
    syncFromPayload(defaultScenePayload(defaultClientId) as Scene);
    setMessage("已套用預設 Scene");
  }, [defaultClientId, syncFromPayload]);

  const addTarget = useCallback(() => {
    setTargets((prev) => [...prev, { client: defaultClientId || "", snapshot: "" }]);
  }, [defaultClientId]);

  const removeTarget = useCallback((index: number) => {
    setTargets((prev) => prev.filter((_, idx) => idx !== index));
  }, []);

  const setTargetField = useCallback((index: number, field: keyof SceneTargetRow, value: string) => {
    setTargets((prev) =>
      prev.map((row, idx) => {
        if (idx !== index) return row;
        return { ...row, [field]: value };
      }),
    );
  }, []);

  const setSceneField = useCallback((field: keyof Scene, value: unknown) => {
    setSceneData((prev) => ({ ...prev, [field]: value as never }));
  }, []);

  const validateAndPreview = useCallback(async () => {
    const payload = buildPayload();
    const errors = validateScene(payload);
    setValidationErrors(errors);
    if (errors.length) {
      setMessage("請先修正表單錯誤");
      return;
    }
    setIsPreviewing(true);
    try {
      const previewList: ScenePreviewEntry[] = [];
      await Promise.all(
        targets.map(async (target, index) => {
          try {
            const { client, name } = parseSnapshotRef(target.snapshot, target.client);
            const data = await getIframeSnapshot(client, name);
            const raw =
              (data as { raw?: unknown }).raw ??
              (data as { snapshot?: unknown }).snapshot ??
              (data as { config?: unknown }).config ??
              data;
            const src = previewSrcFromConfig(raw as Record<string, unknown>);
            previewList.push({
              client,
              snapshot: `${client}/${name}`,
              previewSrc: src,
            });
          } catch (err) {
            previewList.push({
              client: target.client || `target-${index + 1}`,
              snapshot: target.snapshot,
              previewSrc: null,
              error: err instanceof Error ? err.message : "解析預覽失敗",
            });
          }
        }),
      );
      setPreviewEntries(previewList);
      setMessage("解析完成");
    } finally {
      setIsPreviewing(false);
    }
  }, [buildPayload, targets]);

  const saveScene = useCallback(async () => {
    const payload = buildPayload();
    const errors = validateScene(payload);
    setValidationErrors(errors);
    if (errors.length) {
      setMessage("請先修正表單錯誤再儲存");
      return;
    }
    setIsSaving(true);
    try {
      const exists = sceneList.some((item) => item.id === payload.id);
      const resp = exists ? await updateScene(payload.id, payload) : await createScene(payload);
      const saved = (resp as { scene?: Scene }).scene || (resp as Scene);
      syncFromPayload(saved);
      await reloadScenes();
      setMessage(exists ? "已更新 scene" : "已建立 scene");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "儲存失敗");
    } finally {
      setIsSaving(false);
    }
  }, [buildPayload, reloadScenes, sceneList, syncFromPayload]);

  const playCurrentScene = useCallback(async () => {
    const targetId = (sceneData.id || "").trim();
    if (!targetId) {
      setMessage("請先指定 scene id");
      return;
    }
    setIsPlaying(true);
    try {
      await playScene(targetId, {});
      setMessage("已送出播放");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "播放失敗");
    } finally {
      setIsPlaying(false);
    }
  }, [sceneData.id]);

  const enqueueScene = useCallback(async () => {
    const targetId = (sceneData.id || "").trim();
    if (!targetId) {
      setMessage("請先指定 scene id");
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
        type: "scene",
        target_id: targetId,
        payload: {},
      });
      setMessage(`已送出 queue 到 ${queueClientId}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "排程失敗");
    } finally {
      setIsEnqueuing(false);
    }
  }, [queueClientId, sceneData.id]);

  useEffect(() => {
    void reloadScenes();
    void refreshSnapshotsForClients(targets.map((t) => t.client));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    syncJson();
  }, [sceneData, targets, tagsText, syncJson]);

  return [
    {
      sceneData,
      tagsText,
      targets,
      sceneList,
      validationErrors,
      previewEntries,
      jsonText,
      message,
      snapshotOptions,
      isSaving,
      isPreviewing,
      isPlaying,
      isEnqueuing,
      queueClientId,
    },
    {
      reloadScenes,
      loadScene,
      applyDefault,
      refreshSnapshotsForClient,
      setSceneField,
      setTagsText,
      setTargets,
      addTarget,
      removeTarget,
      setTargetField,
      validateAndPreview,
      saveScene,
      playCurrentScene,
      enqueueScene,
      setQueueClientId,
    },
  ];
}
