import type { IframeConfig, IframePanelConfig } from "../types/control";
import type { SnapshotConfig, SnapshotPanel } from "../types/admin";
import type { Scene, Script, ScriptEntry } from "../types/scene";
import type { EpisodeEntry, EpisodeTrack, IframeTimeline, TimelineStep } from "../types/timeline";

export type EditorMode = "timeline" | "episode" | "snapshot";

export interface EditorValidationError {
  path: string;
  message: string;
}

function validateAudioMix(
  mix: Partial<Scene["audio_mix"]> | null | undefined,
  basePath: string,
  errors: EditorValidationError[],
): void {
  if (!mix || typeof mix !== "object") return;
  const left = (mix as { left?: unknown }).left;
  const right = (mix as { right?: unknown }).right;
  const mode = (mix as { mode?: unknown }).mode;
  const push = (field: string, message: string) => errors.push({ path: `${basePath}.${field}`, message });
  if (left !== undefined && left !== null && (Number(left) < 0 || Number(left) > 1)) {
    push("left", "left 需介於 0~1");
  }
  if (right !== undefined && right !== null && (Number(right) < 0 || Number(right) > 1)) {
    push("right", "right 需介於 0~1");
  }
  if (mode !== undefined && mode !== null && typeof mode === "string" && mode.trim().length > 64) {
    push("mode", "mode 長度過長");
  }
}

export function validateScene(data: Partial<Scene> | null | undefined): EditorValidationError[] {
  const errors: EditorValidationError[] = [];
  if (!data || typeof data !== "object") {
    return [{ path: "root", message: "scene 需要是物件" }];
  }
  const id = (data as { id?: unknown }).id;
  if (!id || String(id).trim().length === 0) {
    errors.push({ path: "id", message: "缺少 scene id" });
  } else {
    const cleaned = String(id).trim();
    if (!/^[A-Za-z0-9_-]+$/.test(cleaned)) {
      errors.push({ path: "id", message: "scene id 僅允許英數、底線、連字號" });
    }
  }

  const rawTargets = (data as { targets?: unknown }).targets;
  const normalizedTargets: Array<{ client: string; snapshot: string }> = [];
  if (rawTargets && typeof rawTargets === "object" && !Array.isArray(rawTargets)) {
    Object.entries(rawTargets as Record<string, unknown>).forEach(([client, ref]) => {
      const c = (client || "").trim();
      const snapshot = String(ref ?? "").trim();
      if (c || snapshot) {
        normalizedTargets.push({ client: c, snapshot });
      }
    });
  } else if (Array.isArray(rawTargets)) {
    rawTargets.forEach((item) => {
      if (!item || typeof item !== "object") return;
      const client = String((item as { client?: unknown }).client ?? "").trim();
      const snapshot = String((item as { snapshot?: unknown }).snapshot ?? "").trim();
      if (client || snapshot) {
        normalizedTargets.push({ client, snapshot });
      }
    });
  }

  if (normalizedTargets.length === 0) {
    errors.push({ path: "targets", message: "需要至少一個 target" });
  } else {
    normalizedTargets.forEach((item, index) => {
      if (!item.client) {
        errors.push({ path: `targets[${index}].client`, message: "client 不可為空" });
      }
      if (!item.snapshot) {
        errors.push({ path: `targets[${index}].snapshot`, message: "snapshot 參考不可為空" });
      } else if (item.snapshot.includes("/")) {
        const [, namePart] = item.snapshot.split("/", 2);
        if (!namePart || !namePart.trim()) {
          errors.push({ path: `targets[${index}].snapshot`, message: "snapshot 名稱不可為空白" });
        }
      }
    });
  }

  validateAudioMix((data as { audio_mix?: Scene["audio_mix"] }).audio_mix, "audio_mix", errors);
  return errors;
}

function validateScriptSnapshot(ref: string, path: string, errors: EditorValidationError[]) {
  const value = (ref || "").trim();
  if (!value) {
    errors.push({ path, message: "snapshot 參考不可為空白" });
    return;
  }
  if (!value.includes("/")) {
    errors.push({ path, message: "snapshot 需要 client/name 格式" });
    return;
  }
  const [clientPart, namePart] = value.split("/", 2);
  if (!clientPart || !clientPart.trim()) {
    errors.push({ path, message: "snapshot 需要 client/name 且 client 不可為空" });
  }
  if (!namePart || !namePart.trim()) {
    errors.push({ path, message: "snapshot 名稱不可為空白" });
  }
}

export function validateScript(data: Partial<Script> | null | undefined): EditorValidationError[] {
  const errors: EditorValidationError[] = [];
  if (!data || typeof data !== "object") {
    return [{ path: "root", message: "script 需要是物件" }];
  }
  const id = (data as { id?: unknown }).id;
  if (!id || String(id).trim().length === 0) {
    errors.push({ path: "id", message: "缺少 script id" });
  } else {
    const cleaned = String(id).trim();
    if (!/^[A-Za-z0-9_-]+$/.test(cleaned)) {
      errors.push({ path: "id", message: "script id 僅允許英數、底線、連字號" });
    }
  }

  const entries = (data as { entries?: unknown }).entries;
  if (!Array.isArray(entries) || entries.length === 0) {
    errors.push({ path: "entries", message: "需要至少一個 entry" });
  } else {
    (entries as Array<Partial<ScriptEntry>>).forEach((entry, index) => {
      if (!entry || typeof entry !== "object") {
        errors.push({ path: `entries[${index}]`, message: "entry 格式不正確" });
        return;
      }
      const type = (entry as { type?: unknown }).type;
      if (type !== "scene" && type !== "snapshot_pair") {
        errors.push({ path: `entries[${index}].type`, message: "type 需為 scene 或 snapshot_pair" });
      }
      const duration = (entry as { duration?: unknown }).duration;
      if (duration === undefined || duration === null || Number(duration) <= 0) {
        errors.push({ path: `entries[${index}].duration`, message: "duration 必須大於 0" });
      }
      if (type === "scene") {
        const sceneId = (entry as { scene_id?: unknown; sceneId?: unknown }).scene_id ?? (entry as { sceneId?: unknown }).sceneId;
        if (!sceneId || String(sceneId).trim().length === 0) {
          errors.push({ path: `entries[${index}].scene_id`, message: "scene entry 需要 scene_id" });
        }
      } else {
        const left = (entry as { left_snapshot?: unknown; leftSnapshot?: unknown }).left_snapshot ?? (entry as { leftSnapshot?: unknown }).leftSnapshot;
        const right =
          (entry as { right_snapshot?: unknown; rightSnapshot?: unknown }).right_snapshot ??
          (entry as { rightSnapshot?: unknown }).rightSnapshot;
        if (!left && !right) {
          errors.push({ path: `entries[${index}].snapshots`, message: "snapshot_pair 至少需要 left 或 right" });
        }
        if (left) validateScriptSnapshot(String(left), `entries[${index}].left_snapshot`, errors);
        if (right) validateScriptSnapshot(String(right), `entries[${index}].right_snapshot`, errors);
      }
      validateAudioMix(
        (entry as { audio_override?: Scene["audio_mix"]; audioOverride?: Scene["audio_mix"] }).audio_override ??
          (entry as { audioOverride?: Scene["audio_mix"] }).audioOverride,
        `entries[${index}].audio_override`,
        errors,
      );
    });
  }

  return errors;
}

export function validateTimeline(data: Partial<IframeTimeline> | null | undefined): EditorValidationError[] {
  const errors: EditorValidationError[] = [];
  if (!data || typeof data !== "object") {
    return [{ path: "root", message: "timeline 需要是物件" }];
  }
  if (!data.id) {
    errors.push({ path: "id", message: "缺少 timeline id" });
  }
  if (!Array.isArray(data.steps) || data.steps.length === 0) {
    errors.push({ path: "steps", message: "需要至少一個 step" });
  } else {
    (data.steps as Array<Partial<TimelineStep>>).forEach((step, index) => {
      if (!step || typeof step !== "object") {
        errors.push({ path: `steps[${index}]`, message: "step 格式不正確" });
        return;
      }
      if (!step.snapshot) {
        errors.push({ path: `steps[${index}].snapshot`, message: "缺少 snapshot" });
      }
      if (step.duration === undefined || step.duration === null || Number(step.duration) <= 0) {
        errors.push({ path: `steps[${index}].duration`, message: "duration 必須大於 0" });
      }
    });
  }
  return errors;
}

export function validateEpisode(data: Partial<EpisodeEntry> | null | undefined): EditorValidationError[] {
  const errors: EditorValidationError[] = [];
  if (!data || typeof data !== "object") {
    return [{ path: "root", message: "episode 需要是物件" }];
  }
  if (!data.id) {
    errors.push({ path: "id", message: "缺少 episode id" });
  }
  if (!Array.isArray(data.tracks) || data.tracks.length === 0) {
    errors.push({ path: "tracks", message: "需要至少一條 track" });
  } else {
    (data.tracks as Array<Partial<EpisodeTrack>>).forEach((track, index) => {
      if (!track.timelineId && !track.timeline_id) {
        errors.push({ path: `tracks[${index}].timelineId`, message: "缺少 timelineId" });
      }
      const target = track.targetClientId || track.target_client_id;
      if (!target) {
        errors.push({ path: `tracks[${index}].targetClientId`, message: "缺少 target client" });
      }
    });
  }
  return errors;
}

export function validateSnapshot(data: Partial<SnapshotConfig> | null | undefined): EditorValidationError[] {
  const errors: EditorValidationError[] = [];
  if (!data || typeof data !== "object") {
    return [{ path: "root", message: "snapshot 需要是物件" }];
  }
  if (!Array.isArray(data.panels) || data.panels.length === 0) {
    errors.push({ path: "panels", message: "需要至少一個 panel" });
  } else {
    (data.panels as Array<Partial<SnapshotPanel>>).forEach((panel, index) => {
      if (!panel || typeof panel !== "object") {
        errors.push({ path: `panels[${index}]`, message: "panel 格式不正確" });
        return;
      }
      const hasUrl = typeof panel.url === "string" && panel.url.trim();
      const hasImage = typeof panel.image === "string" && panel.image.trim();
      if (!hasUrl && !hasImage) {
        errors.push({ path: `panels[${index}]`, message: "需要 url 或 image" });
      }
      const ratio = (panel as { ratio?: number }).ratio;
      if (ratio !== undefined && Number(ratio) <= 0) {
        errors.push({ path: `panels[${index}].ratio`, message: "ratio 必須大於 0" });
      }
    });
  }
  return errors;
}

export function formatTs(ts?: string | number | Date | null): string {
  if (!ts) return "";
  const date = typeof ts === "string" || typeof ts === "number" ? new Date(ts) : ts;
  return date.toLocaleString();
}

export function toggleIndex(selected: number[], index: number): number[] {
  if (selected.includes(index)) return selected.filter((i) => i !== index);
  return [...selected, index];
}

export function snapshotValueForSelect(
  step?: Partial<TimelineStep> | null,
  timeline?: Partial<IframeTimeline> | null,
  fallbackClient?: string | null,
): string {
  if (!step || !step.snapshot) return "";
  const ref = String(step.snapshot).trim();
  if (!ref) return "";
  if (ref.includes("/")) return ref;
  const client =
    (step.clientId as string | undefined) ||
    (step as { client_id?: string }).client_id ||
    (timeline?.clientId as string | undefined) ||
    (timeline as { client_id?: string })?.client_id ||
    fallbackClient ||
    "";
  return client ? `${client}/${ref}` : ref;
}
