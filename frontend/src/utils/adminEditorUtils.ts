import type { IframeConfig, IframePanelConfig } from "../types/control";
import type { SnapshotConfig, SnapshotPanel } from "../types/admin";
import type { EpisodeEntry, EpisodeTrack, IframeTimeline, TimelineStep } from "../types/timeline";

export type EditorMode = "timeline" | "episode" | "snapshot";

export interface EditorValidationError {
  path: string;
  message: string;
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
