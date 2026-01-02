import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./VjMode.css";
import { useSlideScreenshot } from "./hooks/useSlideScreenshot";
import { useMicAudioFeatures } from "./hooks/useMicAudioFeatures";
import { useVjImagePool } from "./hooks/useVjImagePool";
import { parseSlidePanelOptions } from "./components/snapshot/slidePanelUtils";
import { SlideSourceMode, cleanId } from "./utils/slideMode";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const clamp01 = (value: number) => clamp(value, 0, 1);

const DEFAULT_VJ_MIN_INTERVAL_MS = 260;
const DEFAULT_VJ_MAX_INTERVAL_MS = 15000;

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

type AudioSnapshot = {
  rms: number;
  centroid: number;
  bands: { low: number; mid: number; high: number };
};

const computeIntensity = ({ rms, bands }: AudioSnapshot): number => {
  return clamp01(rms * 1.25 + bands.mid * 0.55 + bands.high * 0.75);
};

const computeIntervalMs = (
  intensity: number,
  minMs = DEFAULT_VJ_MIN_INTERVAL_MS,
  maxMs = DEFAULT_VJ_MAX_INTERVAL_MS,
): number => {
  const t = clamp01(intensity);
  // 低能量 → 很慢；高能量 → 明顯加速
  return minMs + (maxMs - minMs) * Math.pow(1 - t, 2.2);
};

export default function VjMode({ imagesBase, anchorImage, onCaptureReady }: VjModeProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [micStarted, setMicStarted] = useState(false);
  const [currentImage, setCurrentImage] = useState<string | null>(() => cleanId(anchorImage) || null);
  const [, bumpDebugTick] = useState(0);

  const urlParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const objectFit = (urlParams.get("object_fit") || "cover") as React.CSSProperties["objectFit"];
  const objectPosition = (urlParams.get("object_position") || "center") as React.CSSProperties["objectPosition"];
  const debugEnabled = useMemo(() => String(urlParams.get("vj_debug") ?? "false") === "true", [urlParams]);

  const vjMinIntervalMs = useMemo(() => {
    const raw = urlParams.get("vj_fast_ms") ?? urlParams.get("vj_min_ms") ?? urlParams.get("vj_min_interval_ms");
    if (!raw) return DEFAULT_VJ_MIN_INTERVAL_MS;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return DEFAULT_VJ_MIN_INTERVAL_MS;
    return clamp(Math.floor(parsed), 80, 5000);
  }, [urlParams]);

  const vjMaxIntervalMs = useMemo(() => {
    const raw = urlParams.get("vj_slow_ms") ?? urlParams.get("vj_max_ms") ?? urlParams.get("vj_max_interval_ms");
    const fallback = DEFAULT_VJ_MAX_INTERVAL_MS;
    const parsed = raw ? Number(raw) : Number.NaN;
    const candidate = Number.isFinite(parsed) ? clamp(Math.floor(parsed), 1000, 60000) : fallback;
    return Math.max(candidate, vjMinIntervalMs);
  }, [urlParams, vjMinIntervalMs]);

  const vjDrift = useMemo(() => {
    const raw = urlParams.get("vj_drift");
    if (!raw) return 1;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return 1;
    return clamp(parsed, 0, 2);
  }, [urlParams]);

  useEffect(() => {
    if (!debugEnabled || !micStarted) return undefined;
    const timer = setInterval(() => {
      bumpDebugTick((prev) => (prev + 1) % 1_000_000);
    }, 120);
    return () => clearInterval(timer);
  }, [debugEnabled, micStarted]);

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
      const intensity = computeIntensity(featuresNow);
      const exploration = clamp01(intensity * 0.85 + featuresNow.centroid * 0.35);

      const rng = rngRef.current || Math.random;
      const n = list.length;

      let idx = 0;
      if (intensity < 0.08) {
        idx = Math.floor(rng() * Math.min(2, n));
      } else {
        let gamma = 3.0 - exploration * 2.2; // 高能量/高頻 → 更常跳遠
        gamma = clamp(gamma, 0.9, 3.0);
        idx = Math.floor(Math.pow(rng(), gamma) * n);
        idx = clamp(idx, 0, n - 1);
      }

      let next = list[idx]?.cleanId || list[0]?.cleanId || null;
      if (!next) return;
      if (next === current && n > 1) {
        const alt = (idx + 1 + Math.floor(rng() * 3)) % n;
        next = list[alt]?.cleanId || next;
      }

      setCurrentImage(next);

      const now = performance.now();
      const driftCooldownMs = reason === "beat" ? 3200 : 5200;
      const driftStrength = clamp01((intensity - 0.22) / 0.78);
      const driftChance = clamp01(((reason === "beat" ? 0.16 : 0.06) * driftStrength) * vjDrift);
      const allowDrift = now - lastDriftAtRef.current > driftCooldownMs;
      const shouldDrift = allowDrift && driftChance > 0 && rng() < driftChance;
      if (shouldDrift) {
        lastDriftAtRef.current = now;
        pool.setAnchor(next);
      }
    },
    [pool, currentImage, featuresRef, vjDrift],
  );

  const toggleMic = useCallback(() => {
    if (!pool.anchor) return;
    if (featuresRef.current.running) {
      stopMic();
      setMicStarted(false);
      return;
    }

    void (async () => {
      await startMic();
      setMicStarted(featuresRef.current.running);
    })();
  }, [pool.anchor, featuresRef, startMic, stopMic]);

  // Ctrl+R toggle 麥克風（只攔截 Ctrl+R，不處理 Cmd+R/Meta+R）
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && !event.metaKey && (event.key === "r" || event.key === "R")) {
        event.preventDefault();
        toggleMic();
      }
    };
    window.addEventListener("keydown", onKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleMic]);

  useEffect(() => {
    if (!micStarted) return () => {};

    let active = true;
    let raf: number | null = null;

    const loop = () => {
      if (!active) return;

      const f = featuresRef.current;
      const now = performance.now();

      const intensity = computeIntensity(f);
      const intervalMs = computeIntervalMs(intensity, vjMinIntervalMs, vjMaxIntervalMs);

      const beatAt = f.beatAt;
      const allowBeat = intensity >= 0.1;
      if (allowBeat && beatAt != null && beatAt !== lastBeatAtHandledRef.current) {
        lastBeatAtHandledRef.current = beatAt;
        lastChangeAtRef.current = now;
        pickNextImage("beat");
      } else {
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
  }, [micStarted, featuresRef, pickNextImage, vjMinIntervalMs, vjMaxIntervalMs]);

  const imageUrl = currentImage ? `${imagesBase}${currentImage}` : null;
  const showOverlay = !micStarted || Boolean(micError) || !pool.anchor;

  const debugAudio = featuresRef.current;
  const debugIntensity = computeIntensity(debugAudio);
  const debugExploration = clamp01(debugIntensity * 0.85 + debugAudio.centroid * 0.35);
  const debugIntervalMs = computeIntervalMs(debugIntensity, vjMinIntervalMs, vjMaxIntervalMs);
  const debugSpeed = (() => {
    const denom = vjMaxIntervalMs - vjMinIntervalMs;
    if (denom <= 0) return 0;
    const normalized = (debugIntervalMs - vjMinIntervalMs) / denom;
    return clamp01(1 - normalized);
  })();

  return (
    <div ref={rootRef} className="vj-root">
      {imageUrl ? (
        <img
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
            <p className="vj-hint">
              Ctrl+R 開關麥克風；參數沿用 `slide_mode`：`top_k` / `slide_source` / `kinship_depth` / `include_deprecated`；另支援
              `vj_debug=true`、`vj_fast_ms`、`vj_slow_ms`、`vj_drift`。
            </p>
          </div>
        </div>
      )}

      {debugEnabled && (
        <div className="vj-debug">
          <div className="vj-debug-header">
            <div className="vj-debug-title">VJ Debug</div>
            <div className="vj-debug-pills">
              <span className={`vj-debug-pill vj-debug-beat${features.beat ? " is-on" : ""}`} title="beat" />
              <span className="vj-debug-pill" title="beat count">
                {debugAudio.beatCount}
              </span>
              <span className="vj-debug-pill" title="items">
                {pool.items?.length ?? 0}
              </span>
            </div>
          </div>

          <div className="vj-debug-kv">
            <div className="vj-debug-k">anchor</div>
            <div className="vj-debug-v">{pool.anchor || "-"}</div>
          </div>
          <div className="vj-debug-kv">
            <div className="vj-debug-k">current</div>
            <div className="vj-debug-v">{currentImage || "-"}</div>
          </div>

          <div className="vj-debug-meter">
            <div className="vj-debug-label">intensity</div>
            <div className="vj-debug-bar">
              <div
                className="vj-debug-bar-fill vj-debug-bar-fill--intensity"
                style={{ width: `${Math.round(debugIntensity * 100)}%` }}
              />
            </div>
            <div className="vj-debug-value">{debugIntensity.toFixed(2)}</div>
          </div>

          <div className="vj-debug-meter">
            <div className="vj-debug-label">speed</div>
            <div className="vj-debug-bar">
              <div
                className="vj-debug-bar-fill vj-debug-bar-fill--speed"
                style={{ width: `${Math.round(debugSpeed * 100)}%` }}
              />
            </div>
            <div className="vj-debug-value">{Math.round(debugIntervalMs)}ms</div>
          </div>

          <div className="vj-debug-meter">
            <div className="vj-debug-label">explore</div>
            <div className="vj-debug-bar">
              <div
                className="vj-debug-bar-fill vj-debug-bar-fill--explore"
                style={{ width: `${Math.round(debugExploration * 100)}%` }}
              />
            </div>
            <div className="vj-debug-value">{debugExploration.toFixed(2)}</div>
          </div>

          <div className="vj-debug-bands">
            <div className="vj-debug-band" title="low">
              <div className="vj-debug-band-label">L</div>
              <div className="vj-debug-bar">
                <div
                  className="vj-debug-bar-fill vj-debug-bar-fill--low"
                  style={{ width: `${Math.round(debugAudio.bands.low * 100)}%` }}
                />
              </div>
            </div>
            <div className="vj-debug-band" title="mid">
              <div className="vj-debug-band-label">M</div>
              <div className="vj-debug-bar">
                <div
                  className="vj-debug-bar-fill vj-debug-bar-fill--mid"
                  style={{ width: `${Math.round(debugAudio.bands.mid * 100)}%` }}
                />
              </div>
            </div>
            <div className="vj-debug-band" title="high">
              <div className="vj-debug-band-label">H</div>
              <div className="vj-debug-bar">
                <div
                  className="vj-debug-bar-fill vj-debug-bar-fill--high"
                  style={{ width: `${Math.round(debugAudio.bands.high * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
