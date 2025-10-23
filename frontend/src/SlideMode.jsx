import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { searchImagesByImage, fetchKinship } from "./api.js";

const FONT_FAMILY = "'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif";

const getSizeClass = (width, height) => {
  if (!width || !height) return "large";
  if (width <= 420 || height <= 360) return "xsmall";
  if (width <= 720 || height <= 520) return "small";
  if (width <= 1024 || height <= 720) return "medium";
  return "large";
};

const computeStyles = (sizeClass) => {
  const root = {
    width: "100vw",
    height: "100vh",
    backgroundColor: "#000",
    color: "#f5f5f5",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "64px 32px 140px",
    boxSizing: "border-box",
    gap: "24px",
    position: "relative",
    overflow: "hidden",
    fontFamily: FONT_FAMILY,
  };

  const stage = {
    width: "100%",
    maxWidth: "90vw",
    maxHeight: "100%",
    minHeight: 0,
    flex: "1 1 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const image = {
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: "contain",
    boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
    borderRadius: "12px",
  };

  const caption = {
    padding: "10px 16px",
    borderRadius: "20px",
    background: "rgba(0,0,0,0.55)",
    border: "1px solid rgba(255,255,255,0.18)",
    fontSize: "14px",
    letterSpacing: "0.05em",
    textAlign: "center",
    maxWidth: "90vw",
  };

  const status = {
    position: "absolute",
    top: "32px",
    left: "50%",
    transform: "translateX(-50%)",
    padding: "8px 16px",
    borderRadius: "16px",
    background: "rgba(20,20,20,0.75)",
    fontSize: "13px",
    letterSpacing: "0.04em",
  };

  const controlBar = {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "12px 20px",
    borderRadius: "24px",
    background: "rgba(20,20,20,0.85)",
    border: "1px solid rgba(255,255,255,0.15)",
    backdropFilter: "blur(10px)",
  };

  const slider = {
    minWidth: "150px",
    height: "4px",
    borderRadius: "2px",
    background: "rgba(255,255,255,0.2)",
    outline: "none",
    cursor: "pointer",
    WebkitAppearance: "none",
    appearance: "none",
    accentColor: "#4a9eff",
  };

  const sliderLabel = {
    fontSize: "12px",
    color: "#888",
    minWidth: "45px",
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
  };

  const button = {
    padding: "6px 12px",
    borderRadius: "6px",
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.05)",
    color: "#f5f5f5",
    cursor: "pointer",
    fontSize: "12px",
    transition: "all 0.2s ease",
    fontFamily: FONT_FAMILY,
  };

  if (sizeClass === "medium") {
    root.padding = "48px 24px 72px";
    stage.maxWidth = "100%";
    caption.maxWidth = "100%";
    caption.fontSize = "13px";
  } else if (sizeClass === "small") {
    root.padding = "24px 16px 32px";
    root.gap = "16px";
    stage.maxWidth = "100%";
    stage.maxHeight = "100%";
    image.boxShadow = "0 12px 40px rgba(0,0,0,0.55)";
    image.borderRadius = "10px";
    caption.fontSize = "12px";
    caption.maxWidth = "100%";
    status.top = "18px";
    status.fontSize = "12px";
    controlBar.padding = "10px 16px";
    controlBar.gap = "12px";
    slider.minWidth = "120px";
    button.fontSize = "11px";
  } else if (sizeClass === "xsmall") {
    root.padding = "12px";
    root.gap = "12px";
    stage.maxWidth = "100%";
    stage.maxHeight = "100%";
    image.boxShadow = "0 10px 28px rgba(0,0,0,0.5)";
    image.borderRadius = "10px";
    caption.fontSize = "11px";
    caption.padding = "8px 12px";
    caption.maxWidth = "100%";
    status.top = "12px";
    status.padding = "6px 12px";
    status.fontSize = "11px";
    controlBar.flexDirection = "column";
    controlBar.alignItems = "stretch";
    controlBar.gap = "12px";
    controlBar.padding = "10px 14px";
    slider.minWidth = "100%";
    slider.width = "100%";
    sliderLabel.minWidth = "auto";
    sliderLabel.textAlign = "center";
    button.width = "100%";
    button.fontSize = "11px";
  }

  return { root, stage, image, caption, status, controlBar, slider, sliderLabel, button };
};

// 添加 CSS 規則用於 slider thumb 的樣式
if (typeof document !== "undefined" && !document.getElementById("sliderStyles")) {
  const style = document.createElement("style");
  style.id = "sliderStyles";
  style.innerHTML = `
    input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #4a9eff;
      cursor: pointer;
      box-shadow: 0 0 8px rgba(74, 158, 255, 0.5);
    }
    input[type="range"]::-moz-range-thumb {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #4a9eff;
      cursor: pointer;
      border: none;
      box-shadow: 0 0 8px rgba(74, 158, 255, 0.5);
    }
    button:hover {
      background: rgba(255,255,255,0.1) !important;
      border-color: rgba(255,255,255,0.3) !important;
    }
  `;
  document.head.appendChild(style);
}

const cleanId = (value) => (value ? value.replace(/:(en|zh)$/, "") : value);

const DISPLAY_ORDER = Array.from({ length: 15 }, (_, i) => i);
const BATCH_SIZE = 15;

export default function SlideMode({ imagesBase, anchorImage, intervalMs = 3000 }) {
  const rootRef = useRef(null);
  const [sizeClass, setSizeClass] = useState("large");
  const styles = useMemo(() => computeStyles(sizeClass), [sizeClass]);
  const [items, setItems] = useState([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [anchor, setAnchor] = useState(null);
  const [generation, setGeneration] = useState(0);
  const [showCaption, setShowCaption] = useState(false);
  const [sourceMode, setSourceMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = (params.get("slide_source") || "vector").toLowerCase();
    return mode === "kinship" ? "kinship" : "vector";
  });
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isPaused, setIsPaused] = useState(false);

  const anchorClean = cleanId(anchorImage);

  useEffect(() => {
    const element = rootRef.current;
    if (!element) return undefined;

    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      const next = getSizeClass(rect.width, rect.height);
      setSizeClass((prev) => (prev === next ? prev : next));
    };

    let observer;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => updateSize());
      observer.observe(element);
      updateSize();
      return () => {
        observer.disconnect();
      };
    }

    updateSize();
    const onResize = () => updateSize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = (params.get("slide_source") || "vector").toLowerCase();
    setSourceMode(mode === "kinship" ? "kinship" : "vector");
    setAnchor(anchorClean || null);
    setGeneration((prev) => prev + 1);
    setItems([]);
    setIndex(0);
    setShowCaption(false);
  }, [anchorClean]);

  useEffect(() => {
    const handler = (event) => {
      if (event.ctrlKey && (event.key === "r" || event.key === "R")) {
        event.preventDefault();
        setShowCaption((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler, { passive: false });
    return () => window.removeEventListener("keydown", handler, { passive: false });
  }, []);

  const performSearch = useCallback(
    (imageId, currentGeneration, mode) => {
      if (!imageId) {
        setItems([]);
        setError("請在網址加入 ?img=offspring_xxx.png 以決定播放內容。");
        setLoading(false);
        return;
      }

      let cancelled = false;
      setLoading(true);
      setError(null);

      const run = async () => {
        try {
          let finalList = [];

          if (mode === "kinship") {
            const data = await fetchKinship(imageId, -1);
            if (cancelled || currentGeneration !== generation) return;

            const ordered = [];
            const seen = new Set();

            const pushList = (arr) => {
              (arr || []).forEach((item) => {
                const clean = cleanId(item);
                if (!clean || seen.has(clean)) return;
                ordered.push({ id: clean, cleanId: clean, distance: null });
                seen.add(clean);
              });
            };

            const children = data?.children || [];
            const siblings = data?.siblings || [];
            const parents = data?.parents || [];
            const ancestorsLevels = data?.ancestors_by_level || [];
            const ancestors = data?.ancestors || [];
            const related = data?.related_images || [];

            pushList(children);
            pushList(siblings);
            pushList(parents);
            ancestorsLevels.forEach((lv) => pushList(lv));
            pushList(ancestors);
            pushList(related);

            const originalClean = cleanId(data?.original_image || imageId);
            if (originalClean && !seen.has(originalClean)) {
              ordered.unshift({ id: originalClean, cleanId: originalClean, distance: null });
              seen.add(originalClean);
            }

            finalList = ordered.slice(0, BATCH_SIZE);
            if (finalList.length === 0 && originalClean) {
              finalList.push({ id: originalClean, cleanId: originalClean, distance: null });
            }
          } else {
            const searchPath = `backend/offspring_images/${imageId}`;
            const data = await searchImagesByImage(searchPath, BATCH_SIZE);
            if (cancelled || currentGeneration !== generation) return;
            const list = Array.isArray(data?.results) ? data.results : [];
            const prepared = list
              .map((item) => ({
                id: item?.id || "",
                cleanId: cleanId(item?.id || ""),
                distance: typeof item?.distance === "number" ? item.distance : null,
              }))
              .filter((entry) => entry.cleanId);

            const ordered = [];
            const seen = new Set();

            DISPLAY_ORDER.forEach((i) => {
              const entry = prepared[i];
              if (!entry || seen.has(entry.cleanId)) return;
              ordered.push(entry);
              seen.add(entry.cleanId);
            });

            prepared.forEach((entry) => {
              if (!seen.has(entry.cleanId)) {
                ordered.push(entry);
                seen.add(entry.cleanId);
              }
            });

            if (!seen.has(imageId)) {
              const clean = cleanId(imageId);
              ordered.unshift({ id: clean, cleanId: clean, distance: null });
            }

            finalList = ordered.slice(0, BATCH_SIZE);
            if (finalList.length === 0) {
              finalList.push({ id: imageId, cleanId: imageId, distance: null });
            }
          }

          setItems(finalList);
          setIndex(0);
        } catch (err) {
          if (cancelled || currentGeneration !== generation) return;
          setError(err?.message || "搜尋失敗，請稍後再試。");
          setItems([{ id: imageId, cleanId: cleanId(imageId), distance: null }]);
          setIndex(0);
        } finally {
          if (!cancelled && currentGeneration === generation) {
            setLoading(false);
          }
        }
      };

      run();

      return () => {
        cancelled = true;
      };
    },
    [generation]
  );

  useEffect(() => {
    if (!anchor) {
      setItems([]);
      return () => {};
    }

    return performSearch(anchor, generation, sourceMode);
  }, [anchor, generation, sourceMode, performSearch]);

  useEffect(() => {
    if (items.length <= 1 || isPaused) return undefined;
    const effectiveInterval = Math.max(1000, intervalMs / playbackSpeed);
    const timer = setInterval(() => {
      setIndex((prev) => {
        const next = prev + 1;
        if (next >= items.length) {
          const last = items[items.length - 1];
          if (last?.cleanId) {
            setAnchor(last.cleanId);
            setGeneration((g) => g + 1);
          }
          return 0;
        }
        return next;
      });
    }, effectiveInterval);
    return () => clearInterval(timer);
  }, [items, intervalMs, playbackSpeed, isPaused]);

  const current = useMemo(() => {
    if (!items.length) return null;
    return items[index % items.length];
  }, [items, index]);

  const imageUrl = current ? `${imagesBase}${current.cleanId}` : null;

  return (
    <div ref={rootRef} style={styles.root}>
      {loading && <div style={styles.status}>正在載入相似影像...</div>}
      {error && <div style={styles.status}>{error}</div>}
      {current ? (
        <>
          <div style={styles.stage}>
            <img
              key={current.cleanId}
              src={imageUrl}
              alt={current.cleanId}
              style={styles.image}
            />
          </div>
          {showCaption && (
            <div style={styles.caption}>
              {items.length > 1 && `${index + 1}/${items.length}`} · {current.cleanId}
            </div>
          )}
          {showCaption && (
            <div style={styles.controlBar}>
              <span style={{ fontSize: "12px", color: "#666" }}>速度</span>
              <input
                type="range"
                min="0.5"
                max="10"
                step="0.1"
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                style={styles.slider}
              />
              <span style={styles.sliderLabel}>{playbackSpeed.toFixed(1)}x</span>
              <button
                onClick={() => setIsPaused(!isPaused)}
                style={styles.button}
              >
                {isPaused ? "▶ 播放" : "⏸ 暫停"}
              </button>
            </div>
          )}
        </>
      ) : (
        <div style={styles.status}>尚無可播放的圖片</div>
      )}
    </div>
  );
}
