import { buildQueryFromIframeConfig } from "./utils/iframeConfig";
import type { EpisodeEntry, IframeTimeline } from "./types/admin";
import type { IframeConfig } from "./types/control";

export function pretty(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch (err) {
    return "";
  }
}

export function minimalConfigPayload(targetClient?: string | null): IframeConfig {
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
      { timelineId: "timeline_a", targetClientId: targetClient },
      { timelineId: "timeline_b", targetClientId: clientB },
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
    let src: string | null = null;
    if ((panel as any).url) {
      src = (panel as any).url as string;
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
    } else if ((panel as any).image) {
      const query = new URLSearchParams({ img: (panel as any).image, static_mode: "true" });
      if ((panel as any).params && typeof (panel as any).params === "object") {
        Object.entries((panel as any).params).forEach(([k, v]) => {
          if (v === null || v === undefined) return;
          query.set(String(k), String(v));
        });
      }
      query.set("client", "preview-main");
      src = `/?${query.toString()}`;
    }
    if (!src) return;
    const colSpan = (panel as any).colSpan ?? (panel as any).col_span;
    const rowSpan = (panel as any).rowSpan ?? (panel as any).row_span;
    panels.push({
      id: (panel as any).id || `p${index + 1}`,
      src,
      ratio: (panel as any).ratio || 1,
      label: (panel as any).label,
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

export function firstSnapshotRef(timeline?: Partial<IframeTimeline> | null): { client: string | null; name: string } | null {
  if (!timeline || !Array.isArray(timeline.steps)) return null;
  const firstStep = timeline.steps.find((step) => step && (step as any).snapshot);
  if (!firstStep) return null;

  const snapshotRef = String((firstStep as any).snapshot || "").trim();
  if (!snapshotRef) return null;

  const timelineClient = (timeline as any).clientId || (timeline as any).client_id || null;
  const stepClient = (firstStep as any).clientId || (firstStep as any).client_id || null;
  const defaultClient = stepClient || timelineClient || null;

  if (snapshotRef.includes("/")) {
    const [clientPart, namePart] = snapshotRef.split("/", 2).map((s) => s.trim());
    if (!namePart) return null;
    return { client: clientPart || defaultClient, name: namePart };
  }

  if (!defaultClient) return null;
  return { client: defaultClient, name: snapshotRef };
}
