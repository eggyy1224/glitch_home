import React, { useEffect, useMemo, useRef, useState } from "react";
import "./SlideMode.css";
import { useSlidePlayback } from "./hooks/useSlidePlayback";
import { useSlideScreenshot } from "./hooks/useSlideScreenshot";
import { computeStyles, getSizeClass } from "./utils/slideMode";

export interface SlideModeProps {
  imagesBase: string;
  anchorImage?: string | null;
  intervalMs?: number;
  onCaptureReady?: ((capture: (() => Promise<Blob>) | null) => void) | null | undefined;
}

export default function SlideMode({ imagesBase, anchorImage, intervalMs = 3000, onCaptureReady }: SlideModeProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [sizeClass, setSizeClass] = useState<"large" | "medium" | "small" | "xsmall">("large");
  const styles = useMemo(() => computeStyles(sizeClass), [sizeClass]) as Record<string, React.CSSProperties>;
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const objectFit = (params.get("object_fit") || "contain") as React.CSSProperties["objectFit"];
  const objectPosition = (params.get("object_position") || "center") as React.CSSProperties["objectPosition"];

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
  } = useSlidePlayback({ anchorImage: anchorImage ?? null, intervalMs, imagesBase });

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

  const imageUrl = current ? `${imagesBase}${current.cleanId}` : null;
  const buttonClassName = `slide-mode-button${isPaused ? " is-paused" : ""}`;

  return (
    <div ref={rootRef} style={styles.root}>
      {loading && <div style={styles.status}>正在載入相似影像...</div>}
      {error && !current && <div style={styles.status}>{error}</div>}
      {current ? (
        <>
          <div style={styles.stage}>
            <img
              key={current.cleanId}
              src={imageUrl || undefined}
              alt={current.cleanId}
              style={{ ...styles.image, objectFit, objectPosition }}
              onError={() => handleImageError(current.cleanId)}
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
                className="slide-mode-slider"
              />
              <span style={styles.sliderLabel}>{playbackSpeed.toFixed(1)}x</span>
              <button onClick={togglePause} style={styles.button} className={buttonClassName}>
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
