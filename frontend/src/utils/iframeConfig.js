const IFRAME_LAYOUTS = new Set(["grid", "horizontal", "vertical"]);

export const clampInt = (value, fallback, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const intVal = Math.floor(parsed);
  if (intVal < min) return min;
  if (intVal > max) return max;
  return intVal;
};

const normalizeIframeLayout = (value, fallback = "grid") => {
  const candidate = (value || "").toString().trim().toLowerCase();
  return IFRAME_LAYOUTS.has(candidate) ? candidate : fallback;
};

const parseRatio = (value, fallback = 1) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

export const parseIframeConfigFromParams = (params) => {
  if (!params) return null;

  const layout = normalizeIframeLayout(params.get("iframe_layout"));
  const gap = clampInt(params.get("iframe_gap"), 0, { min: 0 });
  const columns = clampInt(params.get("iframe_columns"), 2, { min: 1 });

  const rawKeys = (params.get("iframe_panels") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const panels = [];
  const keys = rawKeys.length ? rawKeys : null;

  if (keys) {
    keys.forEach((key, index) => {
      const src = params.get(`iframe_${key}`);
      if (!src) return;
      const ratio = parseRatio(params.get(`iframe_${key}_ratio`), 1);
      const label = params.get(`iframe_${key}_label`) || undefined;
      panels.push({
        id: key || `panel_${index + 1}`,
        src,
        ratio,
        label,
      });
    });
  } else {
    for (let index = 1; index <= 12; index += 1) {
      const key = `${index}`;
      const src = params.get(`iframe_${key}`);
      if (!src) break;
      const ratio = parseRatio(params.get(`iframe_${key}_ratio`), 1);
      const label = params.get(`iframe_${key}_label`) || undefined;
      panels.push({
        id: key,
        src,
        ratio,
        label,
      });
    }
  }

  if (!panels.length) {
    return null;
  }

  return { layout, gap, columns, panels };
};

const sanitizePanels = (panels, fallbackPanels = []) => {
  if (!Array.isArray(panels)) return [...fallbackPanels];
  const usedIds = new Set();
  const result = [];
  const clampSpan = (value) => {
    if (value === null || value === undefined) return undefined;
    const parsed = clampInt(value, 1, { min: 1 });
    return parsed || 1;
  };
  panels.forEach((panel, index) => {
    if (!panel || typeof panel !== "object") return;
    const src = typeof panel.src === "string" ? panel.src.trim() : "";
    if (!src) return;
    let id = typeof panel.id === "string" && panel.id.trim() ? panel.id.trim() : `panel_${index + 1}`;
    if (usedIds.has(id)) {
      id = `${id}_${index + 1}`;
    }
    usedIds.add(id);
    const ratio = parseRatio(panel.ratio, 1);
    const label = typeof panel.label === "string" && panel.label.trim() ? panel.label.trim() : undefined;
    const colSpan = clampSpan(panel.col_span ?? panel.colSpan);
    const rowSpan = clampSpan(panel.row_span ?? panel.rowSpan);
    result.push({
      id,
      src,
      ratio,
      label,
      image: panel.image,
      params: panel.params,
      url: panel.url,
      colSpan,
      rowSpan,
    });
  });
  return result.length ? result : [...fallbackPanels];
};

export const sanitizeIframeConfig = (config, fallback) => {
  const base = fallback || { layout: "grid", gap: 0, columns: 2, panels: [] };
  if (!config || typeof config !== "object") {
    return { ...base, panels: [...(base.panels || [])] };
  }
  const layout = normalizeIframeLayout(config.layout, base.layout);
  const gap = clampInt(config.gap, base.gap, { min: 0 });
  const columns = clampInt(config.columns, base.columns, { min: 1 });
  const panels = sanitizePanels(config.panels, base.panels || []);
  return { layout, gap, columns, panels };
};

export const buildQueryFromIframeConfig = (config) => {
  if (!config || typeof config !== "object") return null;
  const panels = Array.isArray(config.panels) ? config.panels : [];
  if (!panels.length) return null;
  const keys = panels.map((_, index) => `p${index + 1}`);
  const entries = [];
  entries.push(["iframe_panels", keys.join(",")]);
  entries.push(["iframe_layout", config.layout]);
  entries.push(["iframe_gap", String(config.gap ?? 0)]);
  entries.push(["iframe_columns", String(config.columns ?? 2)]);
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
  });
  return entries;
};
