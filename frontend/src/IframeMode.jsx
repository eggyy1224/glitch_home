import React, { useMemo, useState, useEffect, useCallback } from "react";

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

  const columnsSetting = useMemo(() => {
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

  const resolvedPanels = useMemo(() => {
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
      for (let index = 1; index <= 12; index += 1) {
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

  const [panels, setPanels] = useState(resolvedPanels);

  useEffect(() => {
    setPanels(resolvedPanels);
  }, [resolvedPanels]);

  const [panelCount, setPanelCount] = useState(() => Math.max(1, resolvedPanels.length || 1));
  const [panelInputs, setPanelInputs] = useState(() => {
    const arr = resolvedPanels.map((panel) => panel.src || "");
    return arr.length ? arr : [""];
  });

  useEffect(() => {
    const nextCount = Math.max(1, resolvedPanels.length || 1);
    setPanelCount(nextCount);
    setPanelInputs(() => {
      const arr = resolvedPanels.map((panel) => panel.src || "");
      return arr.length ? arr : [""];
    });
  }, [resolvedPanels]);

  useEffect(() => {
    setPanelInputs((prev) => {
      const next = prev.slice(0, panelCount);
      while (next.length < panelCount) {
        next.push("");
      }
      return next;
    });
  }, [panelCount]);

  const [isControlOpen, setControlOpen] = useState(false);

  useEffect(() => {
    const handler = (event) => {
      if (event.ctrlKey && !event.metaKey && (event.key === "r" || event.key === "R")) {
        event.preventDefault();
        setControlOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler, { passive: false });
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const effectiveColumns = useMemo(() => {
    if (layout !== "grid") return columnsSetting;
    const minColumns = Math.max(1, columnsSetting || 1);
    if (!panels.length) return minColumns;
    return Math.max(1, Math.min(minColumns, panels.length));
  }, [layout, columnsSetting, panels.length]);

  const containerStyle = useMemo(() => {
    const base = {
      width: "100vw",
      height: "100vh",
      backgroundColor: "#000",
      boxSizing: "border-box",
      padding: gap ? `${gap}px` : 0,
    };

    if (layout === "grid") {
      return {
        ...base,
        display: "grid",
        gridTemplateColumns: `repeat(${effectiveColumns}, minmax(0, 1fr))`,
        gridAutoRows: "1fr",
        gap: `${gap}px`,
      };
    }

    return {
      ...base,
      display: "flex",
      flexDirection: layout === "vertical" ? "column" : "row",
      gap: `${gap}px`,
    };
  }, [layout, gap, effectiveColumns]);

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

  const controlWrapperStyle = useMemo(
    () => ({
      position: "fixed",
      top: 16,
      right: 16,
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-end",
      gap: 8,
      zIndex: 1000,
      pointerEvents: "none",
      fontFamily: "'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif",
    }),
    [],
  );

  const controlPanelStyle = useMemo(
    () => ({
      pointerEvents: "auto",
      width: 320,
      maxWidth: "80vw",
      maxHeight: "70vh",
      overflowY: "auto",
      padding: "16px 20px",
      borderRadius: "16px",
      background: "rgba(10, 10, 10, 0.9)",
      border: "1px solid rgba(255, 255, 255, 0.18)",
      boxShadow: "0 15px 40px rgba(0, 0, 0, 0.6)",
      color: "#f5f5f5",
      display: "flex",
      flexDirection: "column",
      gap: "14px",
    }),
    [],
  );

  const controlLabelStyle = useMemo(
    () => ({
      fontSize: "12px",
      letterSpacing: "0.05em",
      marginBottom: 4,
    }),
    [],
  );

  const controlInputStyle = useMemo(
    () => ({
      width: "100%",
      padding: "8px 10px",
      borderRadius: "8px",
      border: "1px solid rgba(255, 255, 255, 0.18)",
      background: "rgba(0, 0, 0, 0.6)",
      color: "#f5f5f5",
      fontSize: "12px",
      letterSpacing: "0.03em",
    }),
    [],
  );

  const applyButtonStyle = useMemo(
    () => ({
      alignSelf: "flex-end",
      padding: "8px 16px",
      borderRadius: "8px",
      border: "1px solid rgba(255, 255, 255, 0.25)",
      background: "rgba(60, 132, 255, 0.35)",
      color: "#f5f5f5",
      fontSize: "12px",
      letterSpacing: "0.06em",
      cursor: "pointer",
      transition: "all 0.2s ease",
    }),
    [],
  );

  const handleToggleControls = useCallback(() => {
    setControlOpen((prev) => !prev);
  }, []);

  const handlePanelCountChange = useCallback((event) => {
    const raw = Number(event.target.value);
    const next = Number.isFinite(raw) ? Math.min(12, Math.max(1, Math.floor(raw))) : 1;
    setPanelCount(next);
  }, []);

  const handlePanelUrlChange = useCallback((index, value) => {
    setPanelInputs((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const handleApplyPanels = useCallback(() => {
    const trimmed = panelInputs.slice(0, panelCount).map((value) => value.trim());
    if (trimmed.some((value) => !value)) {
      window.alert("請填寫所有面板的網址。");
      return;
    }

    const keys = trimmed.map((_, index) => `p${index + 1}`);
    const nextPanels = trimmed.map((src, index) => ({
      id: keys[index],
      src,
      ratio: 1,
    }));

    setPanelInputs(trimmed);
    setPanels(nextPanels);

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      const paramsToUpdate = url.searchParams;

      const reservedKeys = new Set(["iframe_mode", "iframe_layout", "iframe_gap", "iframe_columns"]);
      const keysToDelete = [];
      paramsToUpdate.forEach((_, key) => {
        if (key.startsWith("iframe_") && !reservedKeys.has(key)) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach((key) => paramsToUpdate.delete(key));

      paramsToUpdate.set("iframe_panels", keys.join(","));
      trimmed.forEach((src, index) => {
        const key = keys[index];
        paramsToUpdate.set(`iframe_${key}`, src);
      });

      paramsToUpdate.set("iframe_layout", layout);
      paramsToUpdate.set("iframe_gap", String(gap));
      paramsToUpdate.set("iframe_columns", String(columnsSetting));

      window.history.replaceState(null, "", `${url.pathname}?${paramsToUpdate.toString()}`);
    }
  }, [panelInputs, panelCount, layout, gap, columnsSetting]);

  const handleSubmit = useCallback(
    (event) => {
      event.preventDefault();
      handleApplyPanels();
    },
    [handleApplyPanels],
  );

  const mainContent = panels.length ? (
    panels.map((panel, index) => {
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
    })
  ) : (
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
  );

  return (
    <>
      <div style={containerStyle}>{mainContent}</div>
      <div style={controlWrapperStyle}>
        {isControlOpen ? (
          <form style={controlPanelStyle} onSubmit={handleSubmit}>
            <div>
              <div style={controlLabelStyle}>面板數量 (1-12)</div>
              <input
                type="number"
                min={1}
                max={12}
                value={panelCount}
                onChange={handlePanelCountChange}
                style={controlInputStyle}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {panelInputs.slice(0, panelCount).map((value, index) => (
                <div key={`panel-input-${index}`} style={{ display: "flex", flexDirection: "column" }}>
                  <div style={controlLabelStyle}>{`Panel ${index + 1} URL`}</div>
                  <input
                    type="text"
                    value={value}
                    onChange={(event) => handlePanelUrlChange(index, event.target.value)}
                    style={controlInputStyle}
                    placeholder="https://example.com"
                  />
                </div>
              ))}
            </div>
            <button type="submit" style={applyButtonStyle}>
              套用設定
            </button>
          </form>
        ) : null}
      </div>
    </>
  );
}
