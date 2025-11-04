import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_CONFIG = {
  layout: "grid",
  gap: 0,
  columns: 2,
  panels: [],
};

let html2canvasLoaderPromise = null;

const ensureHtml2Canvas = () => {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("瀏覽器環境才支援截圖"));
  }
  if (window.html2canvas) {
    return Promise.resolve(window.html2canvas);
  }

  if (html2canvasLoaderPromise) {
    return html2canvasLoaderPromise;
  }

  html2canvasLoaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
    script.async = true;
    script.onload = () => {
      if (window.html2canvas) {
        resolve(window.html2canvas);
      } else {
        html2canvasLoaderPromise = null;
        reject(new Error("載入截圖模組失敗"));
      }
    };
    script.onerror = () => {
      html2canvasLoaderPromise = null;
      reject(new Error("下載 html2canvas 失敗"));
    };
    document.head.appendChild(script);
  });

  return html2canvasLoaderPromise;
};

const blobToDrawable = async (blob) => {
  if (!blob) return null;
  if (typeof window !== "undefined" && typeof window.createImageBitmap === "function") {
    try {
      const bitmap = await window.createImageBitmap(blob);
      return { kind: "bitmap", value: bitmap };
    } catch (err) {
      // fall through to Image fallback
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ kind: "image", value: img });
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
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
  const clampSpan = (value) => {
    if (value === null || value === undefined) return undefined;
    return clampInt(value, 1, { min: 1 }) || 1;
  };
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
        colSpan: clampSpan(panel.col_span ?? panel.colSpan),
        rowSpan: clampSpan(panel.row_span ?? panel.rowSpan),
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
  onCaptureReady = null,
}) {
  const containerRef = useRef(null);
  const iframeRefs = useRef({});
  const sanitizedConfig = useMemo(() => sanitizeConfig(config), [config]);
  const panels = sanitizedConfig.panels;

  const [isControlOpen, setControlOpen] = useState(false);
  const [panelCount, setPanelCount] = useState(() => Math.max(1, panels.length || 1));
  const [panelInputs, setPanelInputs] = useState(() => {
    const arr = panels.map((panel) => panel.src || "");
    return arr.length ? arr : [""];
  });

  useEffect(() => {
    if (typeof onCaptureReady !== "function") {
      return undefined;
    }

    const makeCapture = () => {
      return async () => {
        const container = containerRef.current;
        if (!container) {
          throw new Error("iframe 容器尚未準備好");
        }

        // 第一步：先用 html2canvas 截取整個容器（包含標籤、背景、間距等外層 DOM）
        const html2canvas = await ensureHtml2Canvas();
        if (!html2canvas) {
          throw new Error("無法載入截圖模組");
        }

        const containerRect = container.getBoundingClientRect();
        const containerWidth = containerRect.width || container.scrollWidth || window.innerWidth;
        const containerHeight = containerRect.height || container.scrollHeight || window.innerHeight;

        // 明確設定 scale: 1 以避免 devicePixelRatio 造成的尺寸問題
        // 並指定精確的寬高以確保 canvas 尺寸正確
        const canvas = await html2canvas(container, {
          backgroundColor: "#000000",
          useCORS: true,
          logging: false,
          scale: 1,
          width: containerWidth,
          height: containerHeight,
          windowWidth: containerWidth,
          windowHeight: containerHeight,
        });

        const ctx = canvas.getContext("2d");
        
        // 如果 html2canvas 產生的 canvas 尺寸不對，強制重新設定
        let finalCanvas = canvas;
        if (canvas.width !== containerWidth || canvas.height !== containerHeight) {
          const correctedCanvas = document.createElement("canvas");
          correctedCanvas.width = containerWidth;
          correctedCanvas.height = containerHeight;
          const correctedCtx = correctedCanvas.getContext("2d");
          
          // 將原 canvas 的內容縮放到正確尺寸
          correctedCtx.drawImage(canvas, 0, 0, containerWidth, containerHeight);
          
          // 使用調整後的 canvas
          finalCanvas = correctedCanvas;
        }

        const finalCtx = finalCanvas.getContext("2d");
        const scaleX = containerWidth > 0 ? finalCanvas.width / containerWidth : 1;
        const scaleY = containerHeight > 0 ? finalCanvas.height / containerHeight : 1;

        // 第二步：並行從每個 iframe 獲取高品質截圖，然後疊上去覆蓋
        const iframeEntries = Object.values(iframeRefs.current);
        const capturePromises = [];

        for (const iframe of iframeEntries) {
          if (!iframe || !iframe.contentWindow) continue;

          const rect = iframe.getBoundingClientRect();
          const offsetX = (rect.left - containerRect.left) * scaleX;
          const offsetY = (rect.top - containerRect.top) * scaleY;
          const width = rect.width * scaleX;
          const height = rect.height * scaleY;

          // 為每個 iframe 創建一個異步任務
          const captureTask = (async () => {
            let drawable = null;

            // 優先使用 3D 場景的截圖功能
            try {
              const captureScene = iframe.contentWindow.__APP_CAPTURE_SCENE;
              if (typeof captureScene === "function") {
                const blob = await captureScene();
                drawable = await blobToDrawable(blob);
              }
            } catch (err) {
              console.warn(`無法從 iframe 捕捉 3D 畫面 (${iframe.title || "unknown"}):`, err);
            }

            // 備援方案：使用 html2canvas
            if (!drawable) {
              try {
                const innerHtml2canvas =
                  iframe.contentWindow.html2canvas ||
                  (iframe.contentWindow.window && iframe.contentWindow.window.html2canvas) ||
                  null;
                if (innerHtml2canvas && iframe.contentDocument) {
                  const innerCanvas = await innerHtml2canvas(iframe.contentDocument.body, {
                    backgroundColor: "#000000",
                    logging: false,
                    useCORS: true,
                  });
                  if (innerCanvas) {
                    drawable = { kind: "image", value: innerCanvas };
                  }
                }
              } catch (err) {
                console.warn(`iframe 備援截圖失敗 (${iframe.title || "unknown"}):`, err);
              }
            }

            // 將 iframe 截圖疊到主 canvas 上（覆蓋 html2canvas 產生的低品質 iframe 區域）
            if (drawable) {
              try {
                if (drawable.kind === "bitmap") {
                  finalCtx.drawImage(drawable.value, offsetX, offsetY, width, height);
                  if (typeof drawable.value.close === "function") {
                    drawable.value.close();
                  }
                } else if (drawable.kind === "image") {
                  finalCtx.drawImage(drawable.value, offsetX, offsetY, width, height);
                }
              } catch (err) {
                console.warn(`繪製 iframe 截圖失敗 (${iframe.title || "unknown"}):`, err);
              }
            }
          })();

          capturePromises.push(captureTask);
        }

        // 等待所有 iframe 截圖完成並疊上去
        await Promise.all(capturePromises);

        return new Promise((resolve, reject) => {
          finalCanvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error("無法產生截圖"));
                return;
              }
              resolve(blob);
            },
            "image/png",
          );
        });
      };
    };

    onCaptureReady(makeCapture());
    return () => {
      onCaptureReady(null);
    };
  }, [onCaptureReady, sanitizedConfig]);

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
        gridAutoFlow: "dense",
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
      <div ref={containerRef} style={containerStyle}>
        {panels.length ? (
          panels.map((panel, index) => {
            const panelId = panel.id || `panel_${index + 1}`;
            const flexStyle = sanitizedConfig.layout === "grid" ? {} : { flex: `${panel.ratio} 1 0` };
            const gridStyle =
              sanitizedConfig.layout === "grid"
                ? {
                    ...(panel.colSpan ? { gridColumn: `span ${panel.colSpan}` } : {}),
                    ...(panel.rowSpan ? { gridRow: `span ${panel.rowSpan}` } : {}),
                  }
                : {};
            const combinedStyle = sanitizedConfig.layout === "grid"
              ? { ...panelStyle, ...gridStyle }
              : { ...panelStyle, ...flexStyle };
            return (
              <div key={panelId} style={combinedStyle}>
                {panel.label ? <div style={labelStyle}>{panel.label}</div> : null}
                <iframe
                  title={panel.label || `iframe-${index + 1}`}
                  src={panel.src}
                  ref={(node) => {
                    if (node) {
                      iframeRefs.current[panelId] = node;
                    } else {
                      delete iframeRefs.current[panelId];
                    }
                  }}
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
