import { buildQueryFromIframeConfig } from "./utils/iframeConfig.js";

export function pretty(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (err) {
    return "";
  }
}

export function minimalConfigPayload(targetClient) {
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
      },
    ],
  };
}

export function defaultTimelinePayload(targetClient) {
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

export function defaultEpisodePayload(targetClient) {
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

export function parseTargetMap(text) {
  if (!text || typeof text !== "string") return {};
  const map = {};
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

export function previewSrcFromConfig(config) {
  if (!config || !Array.isArray(config.panels)) return null;

  const panels = [];
  config.panels.forEach((panel, index) => {
    if (!panel || typeof panel !== "object") return;
    let src = null;
    if (panel.url) {
      src = panel.url;
      try {
        const url = new URL(src, window.location.origin);
        url.searchParams.set("client", "preview-main");
        if (url.origin === window.location.origin) {
          src = `${url.pathname}${url.search}${url.hash}`;
        } else {
          src = url.toString();
        }
      } catch (err) {
        // fallback to appending when URL parsing fails
        const hasQuery = src.includes("?");
        const joiner = hasQuery ? "&" : "?";
        src = `${src}${joiner}client=preview-main`;
      }
    } else if (panel.image) {
      const query = new URLSearchParams({ img: panel.image, static_mode: "true" });
      if (panel.params && typeof panel.params === "object") {
        Object.entries(panel.params).forEach(([k, v]) => {
          if (v === null || v === undefined) return;
          query.set(String(k), String(v));
        });
      }
      query.set("client", "preview-main");
      src = `/?${query.toString()}`;
    }
    if (!src) return;
    const colSpan = panel.colSpan ?? panel.col_span;
    const rowSpan = panel.rowSpan ?? panel.row_span;
    panels.push({
      id: panel.id || `p${index + 1}`,
      src,
      ratio: panel.ratio || 1,
      label: panel.label,
      ...(colSpan ? { colSpan } : {}),
      ...(rowSpan ? { rowSpan } : {}),
    });
  });

  if (!panels.length) return null;
  const cfg = {
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

export function timelinePlaybackSrc(timelineId) {
  if (!timelineId) return null;
  const qs = new URLSearchParams();
  qs.set("iframe_mode", "true");
  qs.set("iframe_preview", "true");
  qs.set("client", "timeline-preview");
  qs.set("iframe_timeline", timelineId);
  qs.set("ts", `${Date.now()}`);
  return `/?${qs.toString()}`;
}

export function firstSnapshotRef(timeline) {
  if (!timeline || !Array.isArray(timeline.steps)) return null;
  const firstStep = timeline.steps.find((step) => step && step.snapshot);
  if (!firstStep) return null;

  const snapshotRef = String(firstStep.snapshot || "").trim();
  if (!snapshotRef) return null;

  const timelineClient = timeline.clientId || timeline.client_id || null;
  const stepClient = firstStep.clientId || firstStep.client_id || null;
  const defaultClient = stepClient || timelineClient || null;

  if (snapshotRef.includes("/")) {
    const [clientPart, namePart] = snapshotRef.split("/", 2).map((s) => s.trim());
    if (!namePart) return null;
    return { client: clientPart || defaultClient, name: namePart };
  }

  if (!defaultClient) return null;
  return { client: defaultClient, name: snapshotRef };
}
