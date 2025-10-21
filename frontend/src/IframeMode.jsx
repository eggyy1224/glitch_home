import React, { useCallback, useEffect, useMemo, useState } from "react";

const DEFAULT_CONFIG = {
  layout: "grid",
  gap: 0,
  columns: 2,
  panels: [],
};

const sanitizeLayout = (raw) => {
  const value = (raw || "").toLowerCase();
  if (value === "horizontal" || value === "vertical" || value === "grid") {
    return value;
  }
  return "grid";
};

const clampInt = (value, fallback, { min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY } = {}) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  const intVal = Math.floor(num);
  if (intVal < min) return min;
  if (intVal > max) return max;
  return intVal;
};

const sanitizePanels = (panels) => {
  if (!Array.isArray(panels)) return [];
  const usedIds = new Set();
  return panels
    .map((panel, index) => {
      if (!panel || typeof panel !== "object") return null;
      const src = typeof panel.src === "string" ? panel.src.trim() : "";
      if (!src) return null;
      let id = typeof panel.id === "string" && panel.id.trim() ? panel.id.trim() : `panel_${index + 1}`;
      if (usedIds.has(id)) {
        id = `${id}_${index + 1}`;
      }
      usedIds.add(id);
      const ratio = Number(panel.ratio);
      return {
        id,
        src,
        label: typeof panel.label === "string" && panel.label.trim() ? panel.label.trim() : undefined,
        ratio: Number.isFinite(ratio) && ratio > 0 ? ratio : 1,
        image: typeof panel.image === "string" && panel.image.trim() ? panel.image.trim() : undefined,
        params: panel.params && typeof panel.params === "object" ? { ...panel.params } : undefined,
        url: typeof panel.url === "string" && panel.url.trim() ? panel.url.trim() : undefined,
      };
    })
    .filter(Boolean);
};

const sanitizeConfig = (config) => {
  if (!config || typeof config !== "object") return { ...DEFAULT_CONFIG };
  const layout = sanitizeLayout(config.layout);
  const gap = clampInt(config.gap, 0, { min: 0 });
  const columns = clampInt(config.columns, 2, { min: 1 });
  const panels = sanitizePanels(config.panels);
  return { layout, gap, columns, panels };
};

export default function IframeMode({
  config,
  controlsEnabled = false,
  onApplyConfig,
}) {
  const sanitizedConfig = useMemo(() => sanitizeConfig(config), [config]);
  const panels = sanitizedConfig.panels;

  const [isControlOpen, setControlOpen] = useState(false);
  const [panelCount, setPanelCount] = useState(() => Math.max(1, panels.length || 1));
  const [panelInputs, setPanelInputs] = useState(() => {
    const arr = panels.map((panel) => panel.src || "");
    return arr.length ? arr : [""];
  });

  useEffect(() => {
    setPanelCount(Math.max(1, panels.length || 1));
    setPanelInputs(() => {
      const arr = panels.map((panel) => panel.src || "");
      return arr.length ? arr : [""];
    });
  }, [panels]);

  useEffect(() => {
    if (!controlsEnabled) {
      setControlOpen(false);
      return undefined;
    }
    const handler = (event) => {
      if (event.ctrlKey && !event.metaKey && (event.key === "r" || event.key === "R")) {
        event.preventDefault();
        setControlOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler, { passive: false });
    return () => window.removeEventListener("keydown", handler);
  }, [controlsEnabled]);

  useEffect(() => {
    if (!controlsEnabled) return;
    setPanelInputs((prev) => {
      const next = prev.slice(0, panelCount);
      while (next.length < panelCount) {
        next.push("");
      }
      return next;
    });
  }, [panelCount, controlsEnabled]);

  const containerStyle = useMemo(() => {
    const base = {
      width: "100vw",
      height: "100vh",
      backgroundColor: "#000",
      boxSizing: "border-box",
      padding: sanitizedConfig.gap ? `${sanitizedConfig.gap}px` : 0,
    };
    if (sanitizedConfig.layout === "grid") {
      return {
        ...base,
        display: "grid",
        gridTemplateColumns: `repeat(${Math.max(1, Math.min(sanitizedConfig.columns, Math.max(1, panels.length)))}, minmax(0, 1fr))`,
        gridAutoRows: "1fr",
        gap: `${sanitizedConfig.gap}px`,
      };
    }
    return {
      ...base,
      display: "flex",
      flexDirection: sanitizedConfig.layout === "vertical" ? "column" : "row",
      gap: `${sanitizedConfig.gap}px`,
    };
  }, [sanitizedConfig, panels.length]);

  const panelStyle = useMemo(
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

  const handlePanelCountChange = useCallback((event) => {
    const next = clampInt(event.target.value, panelCount, { min: 1, max: 12 });
    setPanelCount(next);
  }, [panelCount]);

  const handlePanelUrlChange = useCallback((index, value) => {
    setPanelInputs((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const handleApply = useCallback(() => {
    if (!controlsEnabled) return;
    const trimmed = panelInputs.slice(0, panelCount).map((value) => value.trim());
    if (trimmed.some((value) => !value)) {
      window.alert("請填寫所有面板的網址。");
      return;
    }

    const nextPanels = trimmed.map((src, index) => {
      const base = panels[index] || {};
      return {
        ...base,
        id: base.id || `panel_${index + 1}`,
        src,
      };
    });

    const nextConfig = {
      ...sanitizedConfig,
      panels: nextPanels,
    };

    if (typeof onApplyConfig === "function") {
      onApplyConfig(nextConfig);
    }
  }, [controlsEnabled, panelInputs, panelCount, panels, sanitizedConfig, onApplyConfig]);

  const handleSubmit = useCallback((event) => {
    event.preventDefault();
    handleApply();
  }, [handleApply]);

  return (
    <>
      <div style={containerStyle}>
        {panels.length ? (
          panels.map((panel, index) => {
            const flexStyle = sanitizedConfig.layout === "grid" ? {} : { flex: `${panel.ratio} 1 0` };
            return (
              <div key={panel.id || index} style={{ ...panelStyle, ...flexStyle }}>
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
        )}
      </div>
      {controlsEnabled ? (
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
      ) : null}
    </>
  );
}

