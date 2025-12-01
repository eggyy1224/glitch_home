import { buildQueryFromIframeConfig } from "./utils/iframeConfig";
import type { EpisodeEntry, IframeTimeline, SnapshotConfig } from "./types/admin";
import type { IframeConfig } from "./types/control";
import type { SnapshotRef } from "./types/timeline";

export function pretty(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch (err) {
    return "";
  }
}

export function minimalConfigPayload(targetClient?: string | null): SnapshotConfig {
  return {
    layout: "grid",
    gap: 0,
    columns: 1,
    panels: [
      {
        id: "p1",
        url: "/",
        params: {},
        ratio: 1,
        label: `${targetClient || "client"} panel`,
        src: "/",
      },
    ],
  };
}

export function defaultTimelinePayload(targetClient?: string | null): IframeTimeline {
  const client = targetClient || "desktop";
  return {
    id: "new_timeline",
    title: "範例 timeline",
    clientId: client,
    loop: false,
    steps: [
      { snapshot: `${client}/desktop_snapshot`, duration: 6, label: "示例段落 A" },
      { snapshot: `${client}/closing_focus`, duration: 6, label: "示例段落 B" },
    ],
  };
}

export function defaultEpisodePayload(targetClient?: string | null): EpisodeEntry {
  const clientB = targetClient === "desktop" ? "desktop2" : `${targetClient}_b`;
  return {
    id: "new_episode",
    title: "範例 Episode",
    tracks: [
      { timelineId: "timeline_a", ...(targetClient ? { targetClientId: targetClient } : {}) },
      { timelineId: "timeline_b", ...(clientB ? { targetClientId: clientB } : {}) },
    ],
    tags: ["demo"],
  };
}

export function parseTargetMap(text?: string | null): Record<string, string> {
  if (!text || typeof text !== "string") return {};
  const map: Record<string, string> = {};
  text
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((entry) => {
      const [key, value] = entry.split(":").map((s) => s.trim());
      if (key && value) {
        map[key] = value;
      }
    });
  return map;
}

export function previewSrcFromConfig(config: Partial<IframeConfig> | null | undefined): string | null {
  if (!config || !Array.isArray(config.panels)) return null;

  const panels: IframeConfig["panels"] = [];
  config.panels.forEach((panel, index) => {
    if (!panel || typeof panel !== "object") return;
    const panelObj: Record<string, unknown> = panel as unknown as Record<string, unknown>;
    let src: string | null = null;
    if (typeof panelObj.url === "string" && panelObj.url) {
      src = panelObj.url;
      try {
        const url = new URL(src, window.location.origin);
        url.searchParams.set("client", "preview-main");
        if (url.origin === window.location.origin) {
          src = `${url.pathname}${url.search}${url.hash}`;
        } else {
          src = url.toString();
        }
      } catch (err) {
        const hasQuery = src.includes("?");
        const joiner = hasQuery ? "&" : "?";
        src = `${src}${joiner}client=preview-main`;
      }
    } else if (typeof panelObj.image === "string" && panelObj.image) {
      const query = new URLSearchParams({ img: panelObj.image, static_mode: "true" });
      if (panelObj.params && typeof panelObj.params === "object") {
        Object.entries(panelObj.params as Record<string, unknown>).forEach(([k, v]) => {
          if (v === null || v === undefined) return;
          query.set(String(k), String(v));
        });
      }
      query.set("client", "preview-main");
      src = `/?${query.toString()}`;
    }
    if (!src) return;
    const colSpan =
      typeof panelObj.colSpan === "number"
        ? panelObj.colSpan
        : typeof panelObj.col_span === "number"
          ? panelObj.col_span
          : undefined;
    const rowSpan =
      typeof panelObj.rowSpan === "number"
        ? panelObj.rowSpan
        : typeof panelObj.row_span === "number"
          ? panelObj.row_span
          : undefined;
    const label = typeof panelObj.label === "string" ? panelObj.label : null;
    panels.push({
      id: (typeof panelObj.id === "string" && panelObj.id) || `p${index + 1}`,
      src,
      ratio: typeof panelObj.ratio === "number" ? panelObj.ratio : 1,
      ...(label ? { label } : {}),
      ...(colSpan ? { colSpan } : {}),
      ...(rowSpan ? { rowSpan } : {}),
    });
  });

  if (!panels.length) return null;
  const cfg: IframeConfig = {
    layout: config.layout || "grid",
    gap: config.gap ?? 0,
    columns: config.columns ?? 1,
    panels,
  };
  const entries = buildQueryFromIframeConfig(cfg);
  if (!entries) return null;
  const qs = new URLSearchParams(entries);
  qs.set("iframe_mode", "true");
  qs.set("iframe_preview", "true");
  qs.set("client", "preview-main");
  return `/?${qs.toString()}`;
}

export function timelinePlaybackSrc(timelineId?: string | null): string | null {
  if (!timelineId) return null;
  const qs = new URLSearchParams();
  qs.set("iframe_mode", "true");
  qs.set("iframe_preview", "true");
  qs.set("client", "timeline-preview");
  qs.set("iframe_timeline", timelineId);
  qs.set("ts", `${Date.now()}`);
  return `/?${qs.toString()}`;
}

export function firstSnapshotRef(timeline?: Partial<IframeTimeline> | null): SnapshotRef | null {
  if (!timeline || !Array.isArray(timeline.steps)) return null;
  const firstStep = timeline.steps.find((step) => step && typeof step.snapshot === "string");
  if (!firstStep) return null;

  const snapshotRef = String(firstStep.snapshot || "").trim();
  if (!snapshotRef) return null;

  const timelineClient = timeline.clientId || (timeline as { client_id?: string }).client_id || null;
  const stepClient = firstStep.clientId || (firstStep as { client_id?: string }).client_id || null;
  const defaultClient = stepClient || timelineClient || null;

  if (snapshotRef.includes("/")) {
    const [clientPart, namePart] = snapshotRef.split("/", 2).map((s) => s.trim());
    if (!namePart) return null;
    return { client: clientPart || defaultClient, name: namePart };
  }

  if (!defaultClient) return null;
  return { client: defaultClient, name: snapshotRef };
}

export function defaultScenePayload(targetClient?: string | null): Record<string, unknown> {
  const clientA = targetClient || "left";
  const clientB = clientA === "left" ? "right" : `${clientA}_b`;
  return {
    id: "new_scene",
    title: "範例 Scene",
    targets: {
      [clientA]: `${clientA}/snapshot_left`,
      [clientB]: `${clientB}/snapshot_right`,
    },
    audio_mix: { left: 1, right: 0.3, mode: "left-dominant" },
    tags: ["demo"],
  };
}

export function defaultScriptPayload(targetClient?: string | null): Record<string, unknown> {
  const clientA = targetClient || "left";
  const clientB = clientA === "left" ? "right" : `${clientA}_b`;
  return {
    id: "new_script",
    title: "範例 Script",
    entries: [
      {
        type: "scene",
        scene_id: "new_scene",
        duration: 5,
      },
      {
        type: "snapshot_pair",
        left_snapshot: `${clientA}/snapshot_left`,
        right_snapshot: `${clientB}/snapshot_right`,
        duration: 5,
        audio_override: { left: 0.8, right: 0.8, mode: "balanced" },
      },
    ],
    tags: ["demo"],
  };
}
