import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./VjMode.css";
import { useSlideScreenshot } from "./hooks/useSlideScreenshot";
import { useMicAudioFeatures } from "./hooks/useMicAudioFeatures";
import { useBgmAudioFeatures } from "./hooks/useBgmAudioFeatures";
import { useVjVideoPool } from "./hooks/useVjVideoPool";
import type { AudioFeatures } from "./hooks/audioAnalysis";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const clamp01 = (value: number) => clamp(value, 0, 1);
const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

const DEFAULT_VJ_BGM_VOLUME = 0.6;
const DEFAULT_RATE_MIN = 0.55;
const DEFAULT_RATE_MAX = 1.8;
const DEFAULT_JUMP_MIN = 0.25;
const DEFAULT_JUMP_MAX = 2.8;
const DEFAULT_SWAP_THRESHOLD = 0.7;
const DEFAULT_SWAP_COOLDOWN_MS = 3200;

const isAutoplayBlockedError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const name = typeof (error as { name?: unknown }).name === "string" ? String((error as { name?: unknown }).name) : "";
  const message =
    typeof (error as { message?: unknown }).message === "string" ? String((error as { message?: unknown }).message) : "";
  const combined = `${name} ${message}`.toLowerCase();
  return (
    name === "NotAllowedError" ||
    combined.includes("notallowed") ||
    combined.includes("autoplay") ||
    combined.includes("user gesture") ||
    combined.includes("gesture")
  );
};

const computeIntensity = ({ rms, bands }: Pick<AudioFeatures, "rms" | "bands">): number => {
  return clamp01(rms * 1.25 + bands.mid * 0.55 + bands.high * 0.75);
};

const parseBooleanParam = (value: string | null | undefined): boolean | undefined => {
  if (value == null) return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return undefined;
};

const parseNumberParam = (value: string | null | undefined): number | undefined => {
  if (value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const resolveVideoBase = (params: URLSearchParams) => {
  const envBase = import.meta?.env?.VITE_VIDEO_BASE as string | undefined;
  const fromQuery = params.get("video_base") || envBase || "/videos/圖像系譜學Video/";
  const trimmed = (fromQuery || "").trim();
  if (!trimmed) return "/videos/圖像系譜學Video/";
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
};

export interface VjVideoModeProps {
  onCaptureReady?: ((capture: (() => Promise<Blob>) | null) => void) | null | undefined;
}

const formatTime = (value: number) => (Number.isFinite(value) ? value.toFixed(2) : "-");

export default function VjVideoMode({ onCaptureReady }: VjVideoModeProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [audioStarted, setAudioStarted] = useState(false);
  const [videoNeedsUserAction, setVideoNeedsUserAction] = useState(false);
  const [videoErrorMessage, setVideoErrorMessage] = useState<string | null>(null);
  const [, bumpDebugTick] = useState(0);
  const lastBeatAtHandledRef = useRef<number | null>(null);
  const lastSwapAtRef = useRef(0);
  const playbackRateRef = useRef(1);
  const failedVideosRef = useRef<Set<string>>(new Set());

  const urlParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const objectFit = (urlParams.get("object_fit") || "cover") as React.CSSProperties["objectFit"];
  const objectPosition = (urlParams.get("object_position") || "center") as React.CSSProperties["objectPosition"];
  const debugEnabled = useMemo(() => String(urlParams.get("vj_debug") ?? "false") === "true", [urlParams]);
  const autostartMic = useMemo(() => String(urlParams.get("vj_autostart_mic") ?? "false") === "true", [urlParams]);

  const vjBgm = useMemo(() => urlParams.get("vj_bgm") || null, [urlParams]);
  const vjBgmVolume = useMemo(() => {
    const raw = urlParams.get("vj_bgm_volume");
    if (!raw) return DEFAULT_VJ_BGM_VOLUME;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return DEFAULT_VJ_BGM_VOLUME;
    return clamp(parsed, 0, 1);
  }, [urlParams]);
  const isBgmMode = Boolean(vjBgm);

  const videoFileName = useMemo(() => urlParams.get("vj_video") || urlParams.get("video") || null, [urlParams]);
  const videoShuffle = useMemo(() => parseBooleanParam(urlParams.get("vj_video_shuffle")) ?? true, [urlParams]);
  const videoBase = useMemo(() => resolveVideoBase(urlParams), [urlParams]);

  const rateMin = useMemo(() => {
    const raw = parseNumberParam(urlParams.get("vj_video_rate_min"));
    return clamp(raw ?? DEFAULT_RATE_MIN, 0.1, 4);
  }, [urlParams]);
  const rateMax = useMemo(() => {
    const raw = parseNumberParam(urlParams.get("vj_video_rate_max"));
    const resolved = clamp(raw ?? DEFAULT_RATE_MAX, 0.2, 6);
    return Math.max(resolved, rateMin);
  }, [urlParams, rateMin]);
  const jumpMin = useMemo(() => {
    const raw = parseNumberParam(urlParams.get("vj_video_jump_min"));
    return clamp(raw ?? DEFAULT_JUMP_MIN, 0.05, 10);
  }, [urlParams]);
  const jumpMax = useMemo(() => {
    const raw = parseNumberParam(urlParams.get("vj_video_jump_max"));
    const resolved = clamp(raw ?? DEFAULT_JUMP_MAX, 0.1, 20);
    return Math.max(resolved, jumpMin);
  }, [urlParams, jumpMin]);
  const swapThreshold = useMemo(() => {
    const raw = parseNumberParam(urlParams.get("vj_video_swap_threshold"));
    return clamp(raw ?? DEFAULT_SWAP_THRESHOLD, 0, 1);
  }, [urlParams]);

  const videoPool = useVjVideoPool({
    preferredVideo: videoFileName,
    shuffle: videoShuffle,
    videoBase,
  });
  const currentVideo = videoPool.current;
  const videoUrl = currentVideo?.url || null;

  useSlideScreenshot({ rootRef, onCaptureReady: onCaptureReady ?? undefined });

  useEffect(() => {
    if (!debugEnabled || !audioStarted) return undefined;
    const timer = setInterval(() => {
      bumpDebugTick((prev) => (prev + 1) % 1_000_000);
    }, 120);
    return () => clearInterval(timer);
  }, [debugEnabled, audioStarted]);

  const micHook = useMicAudioFeatures();
  const bgmHook = useBgmAudioFeatures({ bgmFile: vjBgm, volume: vjBgmVolume });

  const featuresRef = isBgmMode ? bgmHook.featuresRef : micHook.featuresRef;
  const features = isBgmMode ? bgmHook.features : micHook.features;
  const audioError = isBgmMode ? bgmHook.error : micHook.error;
  const startAudio = isBgmMode ? bgmHook.start : micHook.start;
  const stopAudio = isBgmMode ? bgmHook.stop : micHook.stop;

  const attemptVideoPlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      const playPromise = video.play();
      if (playPromise && typeof playPromise.then === "function") {
        await playPromise;
      }
      setVideoNeedsUserAction(false);
      setVideoErrorMessage(null);
    } catch (err) {
      const isBlocked = isAutoplayBlockedError(err);
      setVideoNeedsUserAction(isBlocked);
      if (!isBlocked && video.error) {
        const code = video.error.code;
        if (code === 4) {
          setVideoErrorMessage("影片格式不支援，請改用 H.264 或調整 VIDEO_ASSETS_DIR。");
        } else {
          setVideoErrorMessage(`影片播放失敗（code ${code}）`);
        }
      }
    }
  }, []);

  const handleVideoError = useCallback(() => {
    const filename = currentVideo?.filename;
    if (filename) {
      failedVideosRef.current.add(filename);
      videoPool.markFailed(filename);
    }
    if (videoPool.videos.length && failedVideosRef.current.size >= videoPool.videos.length) {
      setVideoErrorMessage("所有影片皆無法播放，請更換影片或調整 VIDEO_ASSETS_DIR。");
    } else {
      setVideoErrorMessage("影片載入失敗，已嘗試切換其他影片。");
    }
    setVideoNeedsUserAction(false);
  }, [currentVideo?.filename, videoPool]);

  const autostartAttemptedRef = useRef(false);
  useEffect(() => {
    if (isBgmMode) return undefined;
    if (!autostartMic) return undefined;
    if (!videoUrl) return undefined;
    if (audioStarted) return undefined;
    if (autostartAttemptedRef.current) return undefined;
    autostartAttemptedRef.current = true;

    void (async () => {
      await startAudio();
      setAudioStarted(featuresRef.current.running);
    })();

    return undefined;
  }, [isBgmMode, autostartMic, videoUrl, audioStarted, startAudio, featuresRef]);

  const bgmAutoStartAttemptedRef = useRef(false);
  useEffect(() => {
    if (!isBgmMode) return;
    if (!videoUrl) return;
    if (audioStarted) return;
    if (bgmAutoStartAttemptedRef.current) return;
    if (!bgmHook.playlist.length) return;
    bgmAutoStartAttemptedRef.current = true;

    void (async () => {
      await bgmHook.start();
      setAudioStarted(true);
    })();
  }, [isBgmMode, videoUrl, audioStarted, bgmHook.playlist.length, bgmHook.start]);

  useEffect(() => {
    if (isBgmMode && bgmHook.features.running && !audioStarted) {
      setAudioStarted(true);
    }
  }, [isBgmMode, bgmHook.features.running, audioStarted]);

  const toggleAudio = useCallback(() => {
    if (!videoUrl) return;
    if (featuresRef.current.running) {
      stopAudio();
      setAudioStarted(false);
      return;
    }
    void (async () => {
      await startAudio();
      setAudioStarted(featuresRef.current.running);
    })();
  }, [videoUrl, featuresRef, startAudio, stopAudio]);

  useEffect(() => {
    if (isBgmMode) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && !event.metaKey && (event.key === "r" || event.key === "R")) {
        event.preventDefault();
        toggleAudio();
      }
    };
    window.addEventListener("keydown", onKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isBgmMode, toggleAudio]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;
    setVideoNeedsUserAction(false);
    video.playbackRate = playbackRateRef.current;
    setVideoErrorMessage(null);
    video.src = videoUrl;
    video.load();
    void attemptVideoPlay();
  }, [videoUrl, attemptVideoPlay]);

  useEffect(() => {
    if (!audioStarted) return () => {};

    let active = true;
    let raf: number | null = null;

    const loop = () => {
      if (!active) return;
      const video = videoRef.current;
      const f = featuresRef.current;
      const now = performance.now();

      if (video) {
        const intensity = computeIntensity(f);
        const targetRate = lerp(rateMin, rateMax, Math.pow(intensity, 0.9));
        const nextRate = lerp(playbackRateRef.current, targetRate, 0.12);
        playbackRateRef.current = nextRate;
        if (!Number.isNaN(nextRate) && Math.abs(video.playbackRate - nextRate) > 0.01) {
          video.playbackRate = nextRate;
        }

        const beatAt = f.beatAt;
        if (beatAt != null && beatAt !== lastBeatAtHandledRef.current) {
          lastBeatAtHandledRef.current = beatAt;

          if (intensity >= 0.12) {
            const duration = Number.isFinite(video.duration) ? video.duration : 0;
            if (duration > 0) {
              const jumpSec = lerp(jumpMin, jumpMax, Math.pow(intensity, 0.95));
              const direction = f.centroid >= 0.55 ? 1 : -1;
              const jitter = (Math.random() - 0.5) * jumpSec * 0.25;
              let nextTime = video.currentTime + direction * (jumpSec + jitter);
              if (nextTime < 0) nextTime = duration - (Math.abs(nextTime) % duration);
              if (nextTime > duration) nextTime = nextTime % duration;
              video.currentTime = clamp(nextTime, 0, Math.max(0, duration - 0.05));
            }
          }

          if (
            intensity >= swapThreshold &&
            videoPool.videos.length > 1 &&
            videoShuffle &&
            now - lastSwapAtRef.current > DEFAULT_SWAP_COOLDOWN_MS
          ) {
            lastSwapAtRef.current = now;
            videoPool.pickNext();
          }
        }
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => {
      active = false;
      if (raf) cancelAnimationFrame(raf);
    };
  }, [audioStarted, featuresRef, rateMin, rateMax, jumpMin, jumpMax, swapThreshold, videoPool, videoShuffle]);

  const showMicOverlay = !isBgmMode && (!audioStarted || Boolean(audioError) || !videoUrl);
  const bgmNeedsClick = isBgmMode && !bgmHook.features.running && Boolean(videoUrl);
  const bgmAutoplayBlocked = isBgmMode && bgmHook.error && bgmHook.error.includes("自動播放");
  const showVideoUnlockOverlay = Boolean(videoUrl) && videoNeedsUserAction;
  const showVideoErrorOverlay = Boolean(videoErrorMessage) && Boolean(videoUrl);

  return (
    <div ref={rootRef} className="vj-root">
      {videoUrl ? (
        <video
          ref={videoRef}
          className="vj-image"
          src={videoUrl}
          muted
          autoPlay
          playsInline
          preload="auto"
          loop
          style={{ objectFit, objectPosition }}
          onError={handleVideoError}
          onCanPlay={() => void attemptVideoPlay()}
          onPlaying={() => {
            setVideoNeedsUserAction(false);
            setVideoErrorMessage(null);
          }}
        />
      ) : (
        <div className="vj-overlay">
          <div className="vj-panel">
            <h2 className="vj-title">VJ Video Mode</h2>
            <p className="vj-desc">
              {videoErrorMessage ||
                (videoPool.loading ? "載入影片清單中..." : videoPool.error || "尚無可播放影片，請確認 /api/video-assets。")}
            </p>
          </div>
        </div>
      )}

      {showMicOverlay && (
        <div className="vj-overlay">
          <div className="vj-panel">
            <h2 className="vj-title">VJ Video Mode（麥克風驅動）</h2>
            <p className="vj-desc">使用麥克風做即時音訊分析，驅動影片的速度與跳段。</p>
            <div className="vj-actions">
              <button type="button" className="vj-button" onClick={toggleAudio} disabled={!videoUrl}>
                {audioStarted ? "停止麥克風" : "啟動麥克風"}
              </button>
              <div className="vj-status">{audioStarted ? "狀態：已啟動" : "狀態：未啟動"}</div>
            </div>
            {audioError && <p className="vj-desc">麥克風錯誤：{audioError}</p>}
            {videoNeedsUserAction && <p className="vj-desc">影片播放需要互動，請點擊一次。</p>}
            <p className="vj-hint">Ctrl+R 開關麥克風；可用 vj_bgm=檔名 切換 BGM 驅動。</p>
          </div>
        </div>
      )}

      {bgmNeedsClick && (
        <div className="vj-overlay vj-overlay--clickable" onClick={() => void bgmHook.start()}>
          <div className="vj-panel">
            <h2 className="vj-title">VJ Video Mode（BGM 驅動）</h2>
            <p className="vj-desc">
              {bgmAutoplayBlocked
                ? "瀏覽器阻擋了自動播放，請點擊任意處開始播放 BGM。"
                : bgmHook.playlist.length === 0
                ? "載入 BGM 清單中..."
                : "點擊任意處開始播放 BGM"}
            </p>
            <div className="vj-actions">
              <button type="button" className="vj-button">
                ▶ 開始播放
              </button>
            </div>
            <p className="vj-hint">BGM: {bgmHook.currentTrack || vjBgm || "載入中..."}</p>
          </div>
        </div>
      )}

      {showVideoUnlockOverlay && (
        <div className="vj-overlay vj-overlay--clickable" onClick={() => void attemptVideoPlay()}>
          <div className="vj-panel">
            <h2 className="vj-title">VJ Video Mode</h2>
            <p className="vj-desc">影片播放需要互動，請點擊任意處啟動。</p>
            <div className="vj-actions">
              <button type="button" className="vj-button">
                ▶ 啟動影片
              </button>
            </div>
          </div>
        </div>
      )}

      {showVideoErrorOverlay && (
        <div className="vj-overlay">
          <div className="vj-panel">
            <h2 className="vj-title">VJ Video Mode</h2>
            <p className="vj-desc">{videoErrorMessage}</p>
            <p className="vj-hint">可嘗試 vj_video=檔名 或 video_base=/videos/。</p>
          </div>
        </div>
      )}

      {isBgmMode && bgmHook.isPlaying && (
        <div className="vj-bgm-status">
          <span className="vj-bgm-icon">♫</span>
          <span className="vj-bgm-track">{bgmHook.currentTrack || "播放中..."}</span>
        </div>
      )}

      {debugEnabled && (
        <div className="vj-debug">
          <div className="vj-debug-header">
            <div className="vj-debug-title">VJ Debug {isBgmMode ? "(BGM)" : "(Mic)"}</div>
            <div className="vj-debug-pills">
              <span className={`vj-debug-pill vj-debug-beat${features.beat ? " is-on" : ""}`} title="beat" />
              <span className="vj-debug-pill" title="beat count">
                {features.beatCount}
              </span>
            </div>
          </div>
          <div className="vj-debug-kv">
            <div className="vj-debug-k">video</div>
            <div className="vj-debug-v">{currentVideo?.filename || "-"}</div>
          </div>
          <div className="vj-debug-kv">
            <div className="vj-debug-k">rate</div>
            <div className="vj-debug-v">{playbackRateRef.current.toFixed(2)}</div>
          </div>
          <div className="vj-debug-kv">
            <div className="vj-debug-k">time</div>
            <div className="vj-debug-v">
              {videoRef.current
                ? `${formatTime(videoRef.current.currentTime)} / ${formatTime(videoRef.current.duration)}`
                : "-"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
