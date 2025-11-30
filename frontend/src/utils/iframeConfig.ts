import type { IframeConfig, IframePanelConfig } from "../types/control";

const IFRAME_LAYOUTS = new Set(["grid", "horizontal", "vertical"]);

export const DEFAULT_IFRAME_CONFIG: IframeConfig = {
  layout: "grid",
  gap: 0,
  columns: 2,
  panels: [],
};

export const clampInt = (
  value: unknown,
  fallback: number | undefined,
  { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER }: { min?: number; max?: number } = {},
): number | undefined => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const intVal = Math.floor(parsed);
  if (intVal < min) return min;
  if (intVal > max) return max;
  return intVal;
};

const normalizeIframeLayout = (value: unknown, fallback = "grid"): string => {
  const candidate = (value || "").toString().trim().toLowerCase();
  return IFRAME_LAYOUTS.has(candidate) ? candidate : fallback;
};

const parseRatio = (value: unknown, fallback = 1): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

export const parseIframeConfigFromParams = (params: URLSearchParams | null | undefined): IframeConfig | null => {
  if (!params) return null;

  const layout = normalizeIframeLayout(params.get("iframe_layout"));
  const gap = clampInt(params.get("iframe_gap"), 0, { min: 0 }) ?? 0;
  const columns = clampInt(params.get("iframe_columns"), 2, { min: 1 }) ?? 2;

  const rawKeys = (params.get("iframe_panels") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const panels: IframePanelConfig[] = [];
  const keys = rawKeys.length ? rawKeys : null;

  if (keys) {
    keys.forEach((key, index) => {
      const src = params.get(`iframe_${key}`);
      if (!src) return;
      const ratio = parseRatio(params.get(`iframe_${key}_ratio`), 1);
      const label = params.get(`iframe_${key}_label`) || undefined;
      const colSpan = clampInt(params.get(`iframe_${key}_col_span`), undefined, { min: 1 });
      const rowSpan = clampInt(params.get(`iframe_${key}_row_span`), undefined, { min: 1 });
      const panel: IframePanelConfig = {
        id: key || `panel_${index + 1}`,
        src,
        ratio,
        ...(Number.isFinite(colSpan) ? { colSpan: colSpan as number } : {}),
        ...(Number.isFinite(rowSpan) ? { rowSpan: rowSpan as number } : {}),
      };
      if (label) panel.label = label;
      panels.push(panel);
    });
  } else {
    for (let index = 1; index <= 12; index += 1) {
      const key = `${index}`;
      const src = params.get(`iframe_${key}`);
      if (!src) break;
      const ratio = parseRatio(params.get(`iframe_${key}_ratio`), 1);
      const label = params.get(`iframe_${key}_label`) || undefined;
      const colSpan = clampInt(params.get(`iframe_${key}_col_span`), undefined, { min: 1 });
      const rowSpan = clampInt(params.get(`iframe_${key}_row_span`), undefined, { min: 1 });
      const panel: IframePanelConfig = {
        id: key,
        src,
        ratio,
        ...(Number.isFinite(colSpan) ? { colSpan: colSpan as number } : {}),
        ...(Number.isFinite(rowSpan) ? { rowSpan: rowSpan as number } : {}),
      };
      if (label) panel.label = label;
      panels.push(panel);
    }
  }

  if (!panels.length) {
    return null;
  }

  return { layout, gap, columns, panels };
};

export const sanitizePanels = (
  panels: unknown,
  fallbackPanels: IframePanelConfig[] = [],
): IframePanelConfig[] => {
  if (!Array.isArray(panels)) return [...fallbackPanels];
  const usedIds = new Set<string>();
  const result: IframePanelConfig[] = [];
  const clampSpan = (value: unknown) => {
    if (value === null || value === undefined) return undefined;
    return clampInt(value, 1, { min: 1 });
  };
  panels.forEach((panel, index) => {
    if (!panel || typeof panel !== "object") return;
    const typed = panel as Record<string, unknown>;
    const src = typeof typed.src === "string" ? typed.src.trim() : "";
    if (!src) return;
    let id = typeof typed.id === "string" && typed.id.trim() ? typed.id.trim() : `panel_${index + 1}`;
    if (usedIds.has(id)) {
      id = `${id}_${index + 1}`;
    }
    usedIds.add(id);
    const ratio = parseRatio(typed.ratio, 1);
    const label = typeof typed.label === "string" && typed.label.trim() ? typed.label.trim() : undefined;
    const image = typeof typed.image === "string" && typed.image.trim() ? typed.image.trim() : undefined;
    const params = typed.params && typeof typed.params === "object" ? { ...(typed.params as Record<string, unknown>) } : undefined;
    const url = typeof typed.url === "string" && typed.url.trim() ? typed.url.trim() : undefined;
    const colSpan = clampSpan((typed as { col_span?: unknown; colSpan?: unknown }).col_span ?? typed.colSpan);
    const rowSpan = clampSpan((typed as { row_span?: unknown; rowSpan?: unknown }).row_span ?? typed.rowSpan);
    const panelEntry: IframePanelConfig = {
      id,
      src,
      ratio,
      ...(params ? { params } : {}),
      ...(url ? { url } : {}),
      ...(colSpan ? { colSpan } : {}),
      ...(rowSpan ? { rowSpan } : {}),
      ...(image ? { image } : {}),
    };
    if (label) panelEntry.label = label;
    result.push(panelEntry);
  });
  return result.length ? result : [...fallbackPanels];
};

export const sanitizeIframeConfig = (
  config: Partial<IframeConfig> | null | undefined,
  fallback: IframeConfig = DEFAULT_IFRAME_CONFIG,
): IframeConfig => {
  const base = fallback || DEFAULT_IFRAME_CONFIG;
  if (!config || typeof config !== "object") {
    return { ...base, panels: [...(base.panels || [])] };
  }
  const layout = normalizeIframeLayout((config as { layout?: unknown }).layout, base.layout);
  const gap = clampInt((config as { gap?: unknown }).gap, base.gap, { min: 0 }) ?? base.gap;
  const columns = clampInt((config as { columns?: unknown }).columns, base.columns, { min: 1 }) ?? base.columns;
  const panels = sanitizePanels((config as { panels?: unknown }).panels, base.panels || []);
  return { layout, gap, columns, panels };
};

export const buildQueryFromIframeConfig = (config: Partial<IframeConfig> | null | undefined): [string, string][] | null => {
  if (!config || typeof config !== "object") return null;
  const panels = Array.isArray((config as { panels?: unknown }).panels) ? (config as { panels: IframePanelConfig[] }).panels : [];
  if (!panels.length) return null;
  const normalizeSpan = (value: unknown) => {
    if (value === null || value === undefined) return undefined;
    const span = clampInt(value, undefined, { min: 1 });
    return Number.isFinite(span) ? span : undefined;
  };
  const keys = panels.map((_, index) => `p${index + 1}`);
  const entries: [string, string][] = [];
  entries.push(["iframe_panels", keys.join(",")]);
  entries.push(["iframe_layout", (config as { layout?: string }).layout ?? "grid"]);
  entries.push(["iframe_gap", String((config as { gap?: number }).gap ?? 0)]);
  entries.push(["iframe_columns", String((config as { columns?: number }).columns ?? 2)]);
  panels.forEach((panel, index) => {
    const key = keys[index];
    if (!panel || typeof panel !== "object") return;
    if (panel.src) {
      entries.push([`iframe_${key}`, panel.src]);
    }
    if (panel.label) {
      entries.push([`iframe_${key}_label`, panel.label]);
    }
    if (panel.ratio && panel.ratio !== 1) {
      entries.push([`iframe_${key}_ratio`, String(panel.ratio)]);
    }
    const colSpan = normalizeSpan(panel.colSpan ?? panel.col_span);
    const rowSpan = normalizeSpan(panel.rowSpan ?? panel.row_span);
    if (colSpan) {
      entries.push([`iframe_${key}_col_span`, String(colSpan)]);
    }
    if (rowSpan) {
      entries.push([`iframe_${key}_row_span`, String(rowSpan)]);
    }
  });
  return entries;
};
