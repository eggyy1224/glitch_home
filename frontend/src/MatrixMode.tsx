import React, { useEffect, useMemo, useRef, useState } from "react";
import "./MatrixMode.css";
import "./SlideMode.css";
import { useSlidePlayback } from "./hooks/useSlidePlayback";
import { useSlideScreenshot } from "./hooks/useSlideScreenshot";
import { computeStyles, getSizeClass } from "./utils/slideMode";

const DEFAULT_MATRIX_COUNT = 100;
const DEFAULT_MATRIX_GAP = 2;

const parseIntParam = (value: string | null | undefined, fallback: number | undefined, { min = 0 } = {}) => {
  if (value == null || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const intVal = Math.floor(parsed);
  return intVal < min ? min : intVal;
};

export interface MatrixModeProps {
  imagesBase: string;
  anchorImage?: string | null;
  intervalMs?: number;
  onCaptureReady?: ((capture: (() => Promise<Blob>) | null) => void) | null | undefined;
}

export default function MatrixMode({ imagesBase, anchorImage, intervalMs = 3000, onCaptureReady }: MatrixModeProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [sizeClass, setSizeClass] = useState<"large" | "medium" | "small" | "xsmall">("large");
  const styles = useMemo(() => computeStyles(sizeClass), [sizeClass]) as Record<string, React.CSSProperties>;
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const objectFit = (params.get("object_fit") || "contain") as React.CSSProperties["objectFit"];
  const objectPosition = (params.get("object_position") || "center") as React.CSSProperties["objectPosition"];

  const matrixCount = useMemo(() => {
    const countFromMatrix = parseIntParam(params.get("matrix_count"), undefined, { min: 1 });
    const countFromTopK = parseIntParam(params.get("top_k"), undefined, { min: 1 });
    return countFromMatrix ?? countFromTopK ?? DEFAULT_MATRIX_COUNT;
  }, [params]);

  const columns = useMemo(() => {
    const fromParams = parseIntParam(params.get("matrix_columns") ?? params.get("matrix_cols"), undefined, { min: 1 });
    if (fromParams) return fromParams;
    return Math.max(1, Math.ceil(Math.sqrt(matrixCount)));
  }, [params, matrixCount]);

  const gap = useMemo(
    () => parseIntParam(params.get("matrix_gap"), DEFAULT_MATRIX_GAP, { min: 0 }) ?? DEFAULT_MATRIX_GAP,
    [params],
  );

  const {
    current,
    items,
    index,
    loading,
    error,
    showCaption,
    playbackSpeed,
    isPaused,
    setPlaybackSpeed,
    togglePause,
    handleImageError,
  } = useSlidePlayback({ anchorImage: anchorImage ?? null, intervalMs, imagesBase, defaultTopK: matrixCount });

  useSlideScreenshot({ rootRef, onCaptureReady: onCaptureReady ?? undefined });

  useEffect(() => {
    const element = rootRef.current;
    if (!element) return undefined;

    const updateSize = (): void => {
      const rect = element.getBoundingClientRect();
      const next = getSizeClass(rect.width, rect.height);
      setSizeClass((prev) => (prev === next ? prev : next));
    };

    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => updateSize());
      observer.observe(element);
      updateSize();
      return () => observer?.disconnect();
    }

    updateSize();
    const onResize = () => updateSize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const displayItems = useMemo(() => {
    if (!items.length) return [];
    return Array.from({ length: matrixCount }, (_, i) => items[(index + i) % items.length]);
  }, [items, index, matrixCount]);

  const gridStyle = useMemo<React.CSSProperties>(
    () => ({
      display: "grid",
      gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      gridAutoRows: "minmax(0, 1fr)",
      gridAutoFlow: "dense",
      gap: `${gap}px`,
      width: "100%",
      height: "100%",
      padding: gap ? `${gap}px` : 0,
      boxSizing: "border-box",
    }),
    [columns, gap],
  );

  const buttonClassName = `slide-mode-button${isPaused ? " is-paused" : ""}`;

  return (
    <div ref={rootRef} style={styles.root}>
      {loading && <div style={styles.status}>正在載入相似影像...</div>}
      {error && !current && <div style={styles.status}>{error}</div>}
      {displayItems.length ? (
        <div style={gridStyle} className="matrix-grid">
          {displayItems.map((item, idx) => {
            const imageUrl = `${imagesBase}${item.cleanId}`;
            return (
              <div key={idx} className="matrix-cell">
                <img
                  src={imageUrl}
                  alt={item.cleanId}
                  className="matrix-image"
                  style={{ objectFit, objectPosition }}
                  loading="lazy"
                  decoding="async"
                  onError={() => handleImageError(item.cleanId)}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div style={styles.status}>尚無可播放的圖片</div>
      )}
      {showCaption && current && (
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
            className="slide-mode-slider"
          />
          <span style={styles.sliderLabel}>{playbackSpeed.toFixed(1)}x</span>
          <button onClick={togglePause} style={styles.button} className={buttonClassName}>
            {isPaused ? "▶ 播放" : "⏸ 暫停"}
          </button>
        </div>
      )}
    </div>
  );
}
