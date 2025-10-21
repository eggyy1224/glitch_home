import React, { useMemo } from "react";

const normalizeLayout = (raw, fallback) => {
  if (typeof raw !== "string" || !raw.trim()) return fallback;
  const value = raw.trim().toLowerCase();
  if (value === "vertical" || value === "grid") return value;
  return "horizontal";
};

const normalizeGap = (raw, fallback) => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
};

const normalizeRatio = (raw, fallback = 1) => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const normalizePositiveInt = (raw, fallback) => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  const intVal = Math.floor(parsed);
  if (intVal <= 0) return fallback;
  return intVal;
};

const defaultConfig = {
  layout: "horizontal",
  gap: 0,
  columns: 2,
  panels: [],
};

export default function IframeMode({ defaults = defaultConfig }) {
  const params = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search);
  }, []);

  const fallbackConfig = useMemo(() => {
    if (!defaults || typeof defaults !== "object") return defaultConfig;
    const panels = Array.isArray(defaults.panels) ? defaults.panels : defaultConfig.panels;
    const layout = normalizeLayout(defaults.layout, defaultConfig.layout);
    const gap = normalizeGap(defaults.gap, defaultConfig.gap);
    const columns = normalizePositiveInt(defaults.columns, defaultConfig.columns);
    return { layout, gap, columns, panels };
  }, [defaults]);

  const layout = useMemo(() => {
    if (!params) return fallbackConfig.layout;
    return normalizeLayout(params.get("iframe_layout"), fallbackConfig.layout);
  }, [params, fallbackConfig.layout]);

  const gap = useMemo(() => {
    if (!params) return fallbackConfig.gap;
    return normalizeGap(params.get("iframe_gap"), fallbackConfig.gap);
  }, [params, fallbackConfig.gap]);

  const columns = useMemo(() => {
    if (!params) return fallbackConfig.columns;
    return normalizePositiveInt(params.get("iframe_columns"), fallbackConfig.columns);
  }, [params, fallbackConfig.columns]);

  const requestedPanelKeys = useMemo(() => {
    if (!params) return null;
    const raw = params.get("iframe_panels");
    if (!raw) return null;
    return raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }, [params]);

  const panels = useMemo(() => {
    const basePanels = fallbackConfig.panels;
    const baseById = new Map(basePanels.map((panel) => [panel.id, panel]));

    const buildPanelsFromKeys = (keys) => {
      if (!keys || !keys.length) return [];
      const list = [];
      const usedIds = new Set();

      keys.forEach((key, index) => {
        const base = baseById.get(key) || {};
        const srcFromParams = params?.get(`iframe_${key}`) ?? params?.get(`${key}_iframe`);
        const src = srcFromParams || base.src || base.defaultSrc;
        if (!src || usedIds.has(key)) return;

        const labelParam = params?.get(`iframe_${key}_label`);
        const label = labelParam ?? base.label;
        const ratioRaw = params?.get(`iframe_${key}_ratio`);
        const fallbackRatio = base.ratio != null ? base.ratio : 1;
        const ratio = normalizeRatio(ratioRaw, fallbackRatio);

        list.push({
          id: key,
          label,
          src,
          ratio,
        });
        usedIds.add(key);
      });

      return list;
    };

    let resolved = buildPanelsFromKeys(requestedPanelKeys);

    if (!resolved.length) {
      resolved = buildPanelsFromKeys(basePanels.map((panel) => panel.id).filter(Boolean));
    }

    if (!resolved.length && params) {
      const sequential = [];
      for (let index = 1; index <= 6; index += 1) {
        const key = `${index}`;
        const src = params.get(`iframe_${key}`);
        if (!src) break;
        const labelParam = params.get(`iframe_${key}_label`);
        const label = labelParam ?? undefined;
        const ratio = normalizeRatio(params.get(`iframe_${key}_ratio`), 1);
        sequential.push({ id: key, label, src, ratio });
      }
      if (sequential.length) {
        resolved = sequential;
      }
    }

    return resolved;
  }, [fallbackConfig.panels, params, requestedPanelKeys]);

  const containerStyle = useMemo(() => {
    if (layout === "grid") {
      return {
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gridAutoRows: "1fr",
        width: "100vw",
        height: "100vh",
        backgroundColor: "#000",
        gap: `${gap}px`,
        boxSizing: "border-box",
        padding: gap ? `${gap}px` : 0,
      };
    }
    return {
      display: "flex",
      flexDirection: layout === "vertical" ? "column" : "row",
      width: "100vw",
      height: "100vh",
      backgroundColor: "#000",
      gap: `${gap}px`,
      boxSizing: "border-box",
      padding: gap ? `${gap}px` : 0,
    };
  }, [layout, gap, columns]);

  const panelBaseStyle = useMemo(
    () => ({
      position: "relative",
      display: "flex",
      flexDirection: "column",
      backgroundColor: "#050505",
      borderRadius: "12px",
      overflow: "hidden",
      minWidth: 0,
      minHeight: 0,
      width: "100%",
      height: "100%",
      boxShadow: "0 12px 32px rgba(0, 0, 0, 0.45)",
    }),
    [],
  );

  const labelStyle = useMemo(
    () => ({
      position: "absolute",
      top: "12px",
      left: "12px",
      padding: "6px 10px",
      borderRadius: "8px",
      background: "rgba(0, 0, 0, 0.55)",
      color: "#f5f5f5",
      fontSize: "12px",
      letterSpacing: "0.05em",
      lineHeight: 1,
      pointerEvents: "none",
      textTransform: "none",
      fontFamily: "'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif",
    }),
    [],
  );

  if (!panels.length) {
    return (
      <div style={containerStyle}>
        <div
          style={{
            color: "#bfbfbf",
            margin: "auto",
            fontSize: "14px",
            letterSpacing: "0.04em",
            fontFamily: "'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif",
          }}
        >
          尚未設定任何 iframe 來源。
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {panels.map((panel, index) => {
        const flexStyle = layout === "grid" ? {} : { flex: `${panel.ratio} 1 0` };
        return (
          <div key={panel.id || index} style={{ ...panelBaseStyle, ...flexStyle }}>
            {panel.label ? <div style={labelStyle}>{panel.label}</div> : null}
            <iframe
              title={panel.label || `iframe-${index + 1}`}
              src={panel.src}
              style={{
                border: "none",
                width: "100%",
                height: "100%",
                backgroundColor: "#000",
              }}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        );
      })}
    </div>
  );
}
