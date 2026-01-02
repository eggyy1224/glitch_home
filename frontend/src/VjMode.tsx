import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./VjMode.css";
import { useSlideScreenshot } from "./hooks/useSlideScreenshot";
import { useMicAudioFeatures } from "./hooks/useMicAudioFeatures";
import { useVjImagePool } from "./hooks/useVjImagePool";
import { parseSlidePanelOptions } from "./components/snapshot/slidePanelUtils";
import { SlideSourceMode, cleanId } from "./utils/slideMode";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const clamp01 = (value: number) => clamp(value, 0, 1);

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export interface VjModeProps {
  imagesBase: string;
  anchorImage?: string | null;
  onCaptureReady?: ((capture: (() => Promise<Blob>) | null) => void) | null | undefined;
}

export default function VjMode({ imagesBase, anchorImage, onCaptureReady }: VjModeProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [micStarted, setMicStarted] = useState(false);
  const [currentImage, setCurrentImage] = useState<string | null>(() => cleanId(anchorImage) || null);

  const urlParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const objectFit = (urlParams.get("object_fit") || "cover") as React.CSSProperties["objectFit"];
  const objectPosition = (urlParams.get("object_position") || "center") as React.CSSProperties["objectPosition"];
  const debugEnabled = useMemo(() => String(urlParams.get("vj_debug") ?? "false") === "true", [urlParams]);

  const slideOptions = useMemo(() => parseSlidePanelOptions(window.location.href), []);
  const topK = slideOptions.topK ?? 30;
  const slideSource = slideOptions.slideSource ?? SlideSourceMode.VECTOR;
  const includeDeprecated = slideOptions.includeDeprecated ?? false;

  const pool = useVjImagePool({
    anchorImage: anchorImage ?? slideOptions.img ?? null,
    topK,
    slideSource,
    kinshipDepth: slideOptions.kinshipDepth ?? null,
    kinshipOrder: slideOptions.kinshipOrder,
    includeDeprecated,
  });

  useSlideScreenshot({ rootRef, onCaptureReady: onCaptureReady ?? undefined });

  const { featuresRef, features, error: micError, start: startMic, stop: stopMic } = useMicAudioFeatures();

  useEffect(() => {
    const first = pool.items?.[0]?.cleanId || null;
    if (!first) return;
    setCurrentImage((prev) => (prev && prev === first ? prev : prev || first));
  }, [pool.items]);

  const rngRef = useRef<ReturnType<typeof mulberry32> | null>(null);
  useEffect(() => {
    const seedBase = hashString(String(pool.anchor || anchorImage || "vj")) ^ hashString(String(Date.now()));
    rngRef.current = mulberry32(seedBase);
  }, [pool.anchor, anchorImage]);

  const lastBeatAtHandledRef = useRef<number | null>(null);
  const lastDriftAtRef = useRef<number>(0);
  const lastChangeAtRef = useRef<number>(performance.now());

  const pickNextImage = useCallback(
    (reason: "beat" | "timer") => {
      const list = Array.isArray(pool.items) ? pool.items : [];
      if (!list.length) return;

      const current = cleanId(currentImage) || "";
      const featuresNow = featuresRef.current;
      const energy = clamp01(featuresNow.rms * 0.8 + featuresNow.bands.high * 0.6 + featuresNow.bands.mid * 0.3);

      const rng = rngRef.current || Math.random;
      const n = list.length;

      let gamma = 2.6 - energy * 2.0; // 高能量 → 更常跳遠
      gamma = clamp(gamma, 0.65, 2.6);
      let idx = Math.floor(Math.pow(rng(), gamma) * n);
      idx = clamp(idx, 0, n - 1);

      let next = list[idx]?.cleanId || list[0]?.cleanId || null;
      if (!next) return;
      if (next === current && n > 1) {
        const alt = (idx + 1 + Math.floor(rng() * 3)) % n;
        next = list[alt]?.cleanId || next;
      }

      setCurrentImage(next);

      const now = performance.now();
      const driftCooldownMs = 900;
      const driftChance = clamp01(0.08 + featuresNow.bands.mid * 0.35 + featuresNow.bands.high * 0.25);
      const allowDrift = reason === "beat" ? now - lastDriftAtRef.current > driftCooldownMs : now - lastDriftAtRef.current > 1600;
      const shouldDrift = allowDrift && rng() < driftChance;
      if (shouldDrift) {
        lastDriftAtRef.current = now;
        pool.setAnchor(next);
      }
    },
    [pool, currentImage, featuresRef],
  );

  const handleStartMic = useCallback(async () => {
    await startMic();
    setMicStarted(featuresRef.current.running);
  }, [startMic, featuresRef]);

  useEffect(() => {
    if (!micStarted) return () => {};

    let active = true;
    let raf: number | null = null;

    const loop = () => {
      if (!active) return;

      const img = imgRef.current;
      const f = featuresRef.current;
      const now = performance.now();

      if (img) {
        const low = f.bands.low;
        const mid = f.bands.mid;
        const high = f.bands.high;
        const rms = f.rms;

        const zoom = 1 + low * 0.08 + rms * 0.05;
        const rot = (high - 0.5) * 1.2;
        const hue = (mid * 240 + high * 90) % 360;
        const sat = 1 + mid * 1.6;
        const contrast = 1 + high * 0.9;
        const brightness = 0.9 + rms * 0.5;
        const blur = Math.max(0, (high - 0.55) * 4.0);

        img.style.transform = `scale(${zoom.toFixed(3)}) rotate(${rot.toFixed(2)}deg)`;
        img.style.filter = `saturate(${sat.toFixed(2)}) contrast(${contrast.toFixed(2)}) brightness(${brightness.toFixed(
          2,
        )}) hue-rotate(${hue.toFixed(1)}deg) blur(${blur.toFixed(2)}px)`;
      }

      const beatAt = f.beatAt;
      if (beatAt != null && beatAt !== lastBeatAtHandledRef.current) {
        lastBeatAtHandledRef.current = beatAt;
        lastChangeAtRef.current = now;
        pickNextImage("beat");
      } else {
        const speed = 0.55 + f.rms * 1.4 + f.bands.mid * 1.1 + f.bands.high * 0.6;
        const intervalMs = clamp(1800 / speed, 220, 2200);
        if (now - lastChangeAtRef.current > intervalMs) {
          lastChangeAtRef.current = now;
          pickNextImage("timer");
        }
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => {
      active = false;
      if (raf) cancelAnimationFrame(raf);
    };
  }, [micStarted, featuresRef, pickNextImage]);

  const imageUrl = currentImage ? `${imagesBase}${currentImage}` : null;
  const showOverlay = !micStarted || Boolean(micError) || !pool.anchor;

  return (
    <div ref={rootRef} className="vj-root">
      {imageUrl ? (
        <img
          ref={imgRef}
          className="vj-image"
          src={imageUrl}
          alt={currentImage || ""}
          style={{ objectFit, objectPosition }}
          loading="eager"
          decoding="async"
          onError={() => {
            const failed = cleanId(currentImage) || "";
            if (!failed) return;
            pool.markFailed(failed);
            const alternatives = (pool.items || []).map((item) => item.cleanId).filter((id) => id && id !== failed);
            const next = alternatives[0] || null;
            if (next) {
              setCurrentImage(next);
            } else {
              setCurrentImage(null);
            }
            pool.refresh?.();
          }}
        />
      ) : (
        <div className="vj-overlay">
          <div className="vj-panel">
            <h2 className="vj-title">VJ Mode</h2>
            <p className="vj-desc">尚無可播放的圖片，請確認網址參數（需要 `?img=...`）。</p>
          </div>
        </div>
      )}

      {showOverlay && (
        <div className="vj-overlay">
          <div className="vj-panel">
            <h2 className="vj-title">VJ Mode（麥克風驅動）</h2>
            {!pool.anchor ? (
              <p className="vj-desc">請在網址加入 `?img=檔名` 作為起點（例如 `offspring_*.png`）。</p>
            ) : (
              <p className="vj-desc">
                會使用麥克風輸入做即時音訊分析，並以「生成式漫遊」方式在相似圖像空間中選片與跳轉。
              </p>
            )}
            {micError && <p className="vj-desc">麥克風錯誤：{micError}</p>}
            <button
              type="button"
              className="vj-button"
              onClick={handleStartMic}
              disabled={!pool.anchor || features.running}
            >
              {features.running ? "麥克風啟動中…" : "啟動麥克風"}
            </button>
            <p className="vj-hint">
              參數沿用 `slide_mode`：`top_k` / `slide_source` / `kinship_depth` / `include_deprecated`；另支援 `vj_debug=true`。
            </p>
            {micStarted && (
              <button
                type="button"
                className="vj-button"
                style={{ marginLeft: 10, background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.92)" }}
                onClick={() => {
                  stopMic();
                  setMicStarted(false);
                }}
              >
                停止
              </button>
            )}
          </div>
        </div>
      )}

      {debugEnabled && (
        <div className="vj-debug">
          <div>anchor: {pool.anchor || "-"}</div>
          <div>current: {currentImage || "-"}</div>
          <div>items: {pool.items?.length ?? 0}</div>
          <div>
            rms: {featuresRef.current.rms.toFixed(3)} | low: {featuresRef.current.bands.low.toFixed(3)} | mid:{" "}
            {featuresRef.current.bands.mid.toFixed(3)} | high: {featuresRef.current.bands.high.toFixed(3)}
          </div>
          <div>beats: {features.beatCount}</div>
        </div>
      )}
    </div>
  );
}
