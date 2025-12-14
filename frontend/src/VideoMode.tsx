import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ensureHtml2Canvas } from "./utils/html2canvasLoader";
import type { VideoController } from "./types/control";
import "./VideoMode.css";

const canvasToBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
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

const DEFAULT_VOLUME = 0.7;
const DEFAULT_SPEED = 1;

const clampVolume = (value: number | string | null | undefined, fallback = DEFAULT_VOLUME) => {
  if (value == null) return fallback;
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(1, Math.max(0, numberValue));
};

const clampSpeed = (value: number | string | null | undefined, fallback = DEFAULT_SPEED) => {
  if (value == null) return fallback;
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(4, Math.max(0.01, numberValue));
};

export interface VideoModeProps {
  onCaptureReady?: ((capture: (() => Promise<Blob>) | null) => void) | null;
  controlRef?: React.MutableRefObject<VideoController | null> | null;
}

export default function VideoMode({ onCaptureReady = null, controlRef = null }: VideoModeProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [volumeLevel, setVolumeLevel] = useState(DEFAULT_VOLUME);
  const [playbackRate, setPlaybackRate] = useState(DEFAULT_SPEED);
  const [needsUserAction, setNeedsUserAction] = useState(false);
  const autoUnmuteAttemptedRef = useRef(false);
  const retryAttemptedRef = useRef(false);

  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const videoFileName = params.get("video");
  const videoBase = useMemo(() => {
    const envBase = import.meta?.env?.VITE_VIDEO_BASE as string | undefined;
    const fromQuery = params.get("video_base") || envBase || "/videos/圖像系譜學Video/";
    const trimmed = (fromQuery || "").trim();
    if (!trimmed) return "/videos/圖像系譜學Video/";
    return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
  }, [params]);
  const autoUnmuteEnabled = useMemo(() => {
    const raw = params.get("auto_unmute");
    if (raw == null) return true;
    return raw !== "false";
  }, [params]);

  const initialVolume = useMemo(() => {
    const raw = params.get("video_volume") ?? params.get("volume");
    return clampVolume(raw, DEFAULT_VOLUME);
  }, [params]);

  const initialSpeed = useMemo(() => {
    const raw = params.get("video_speed") ?? params.get("speed");
    return clampSpeed(raw, DEFAULT_SPEED);
  }, [params]);

  const loopEnabled = useMemo(() => {
    const raw = params.get("loop");
    if (raw == null) return true;
    const text = raw.trim().toLowerCase();
    if (!text) return true;
    return !(text === "false" || text === "0");
  }, [params]);

  const videoUrl = videoFileName ? `${videoBase}${videoFileName}` : null;

  useEffect(() => {
    setVolumeLevel(initialVolume);
  }, [initialVolume]);

  useEffect(() => {
    setPlaybackRate(initialSpeed);
  }, [initialSpeed]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volumeLevel;
  }, [volumeLevel]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = playbackRate;
  }, [playbackRate]);

  const playVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video) return Promise.resolve();
    video.playbackRate = playbackRate;
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === "function") {
      return playPromise
        .then(() => {
          setNeedsUserAction(false);
        })
        .catch((err) => {
          setNeedsUserAction(true);
          throw err;
        });
    }
    setNeedsUserAction(false);
    return Promise.resolve();
  }, [playbackRate]);

  const pauseVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
  }, []);

  const setMutedState = useCallback(
    (nextMuted: boolean) => {
      const video = videoRef.current;
      if (!video) return;
      const finalMuted = Boolean(nextMuted);
      video.muted = finalMuted;
      setIsMuted(finalMuted);
      if (!finalMuted) {
        void playVideo();
      }
    },
    [playVideo],
  );

  const setVolumeState = useCallback(
    (value: number | string | null | undefined) => {
      const video = videoRef.current;
      if (!video) return;
      const clamped = clampVolume(value, volumeLevel);
      video.volume = clamped;
      setVolumeLevel(clamped);
      if (clamped > 0 && video.muted) {
        video.muted = false;
        setIsMuted(false);
      }
    },
    [volumeLevel],
  );

  const seekVideo = useCallback((timeInSeconds: number | string | null | undefined) => {
    const video = videoRef.current;
    if (!video) return;
    const parsed = typeof timeInSeconds === "number" ? timeInSeconds : Number(timeInSeconds);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    try {
      video.currentTime = parsed;
    } catch (err) {
      // ignore invalid seek
    }
  }, []);

  const setSpeedState = useCallback(
    (value: number | string | null | undefined) => {
      const clamped = clampSpeed(value, playbackRate);
      setPlaybackRate(clamped);
      const video = videoRef.current;
      if (!video) return;
      video.playbackRate = clamped;
    },
    [playbackRate],
  );

  const handleRecoverVideo = useCallback(() => {
    if (retryAttemptedRef.current) return;
    const video = videoRef.current;
    if (!video) return;
    retryAttemptedRef.current = true;

    const seekTo = Number.isFinite(video.currentTime) ? video.currentTime : 0;
    const restoreTime = () => {
      if (!video) return;
      try {
        video.currentTime = seekTo;
      } catch {
        // ignore seek failure
      }
      video.removeEventListener("loadeddata", restoreTime);
      video.removeEventListener("canplay", restoreTime);
    };

    video.addEventListener("loadeddata", restoreTime);
    video.addEventListener("canplay", restoreTime);
    video.load();
    void video.play().catch(() => setNeedsUserAction(true));
  }, []);

  useEffect(() => {
    if (!controlRef) return undefined;
    controlRef.current = {
      play: () => playVideo(),
      pause: () => pauseVideo(),
      setVolume: (value?: number | string | null) => setVolumeState(value ?? null),
      setMuted: (muted?: boolean) => setMutedState(Boolean(muted)),
      seek: (timeInSeconds?: number | string | null) => seekVideo(timeInSeconds ?? null),
      setSpeed: (speed?: number | string | null) => setSpeedState(speed ?? null),
    };
    return () => {
      controlRef.current = null;
    };
  }, [controlRef, pauseVideo, playVideo, seekVideo, setMutedState, setSpeedState, setVolumeState]);

  const handleToggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !isMuted;
    video.muted = nextMuted;
    if (!nextMuted && video.paused) {
      video.play().then(() => setNeedsUserAction(false)).catch(() => {
        setNeedsUserAction(true);
      });
    }
    setIsMuted(nextMuted);
  }, [isMuted]);

  const handleKeyToggle = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      handleToggleMute();
    },
    [handleToggleMute],
  );

  useEffect(() => {
    autoUnmuteAttemptedRef.current = false;
    retryAttemptedRef.current = false;
  }, [videoUrl, autoUnmuteEnabled]);

  useEffect(() => {
    if (!autoUnmuteEnabled) return undefined;
    if (autoUnmuteAttemptedRef.current) return undefined;
    let cancelled = false;
    let cleanupListener: (() => void) | null = null;
    let rafId: number | null = null;

    const attemptAutoUnlock = () => {
      if (cancelled) return;
      const video = videoRef.current;
      if (!video) return;
      video.volume = initialVolume;
      video.muted = false;
      setVolumeLevel(initialVolume);
      setIsMuted(false);
      video
        .play()
        .then(() => {
          if (!cancelled) {
            setNeedsUserAction(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setNeedsUserAction(true);
          }
        });
    };

    const setupAutoUnlock = () => {
      if (cancelled) return;
      const video = videoRef.current;
      if (!video) {
        rafId = window.requestAnimationFrame(setupAutoUnlock);
        return;
      }
      if (autoUnmuteAttemptedRef.current) {
        return;
      }
      autoUnmuteAttemptedRef.current = true;

      if (video.readyState >= 2) {
        attemptAutoUnlock();
        return;
      }

      const onCanPlay = () => {
        video.removeEventListener("canplay", onCanPlay);
        attemptAutoUnlock();
      };
      video.addEventListener("canplay", onCanPlay);
      cleanupListener = () => {
        video.removeEventListener("canplay", onCanPlay);
      };
    };

    setupAutoUnlock();

    return () => {
      cancelled = true;
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      if (cleanupListener) {
        cleanupListener();
      }
    };
  }, [autoUnmuteEnabled, initialVolume, videoUrl]);

  useEffect(() => {
    if (!needsUserAction) return undefined;
    const handler = () => {
      setNeedsUserAction(false);
      setIsMuted(false);
      const video = videoRef.current;
      if (video) {
        video.muted = false;
        void video.play();
      }
    };
    document.addEventListener("click", handler, { once: true });
    return () => {
      document.removeEventListener("click", handler);
    };
  }, [needsUserAction]);

  useEffect(() => {
    if (typeof onCaptureReady !== "function") {
      return undefined;
    }

    const captureScene = async () => {
      const root = rootRef.current;
      if (!root) {
        throw new Error("Video 模式尚未準備好");
      }
      const html2canvas = await ensureHtml2Canvas();
      const canvas = await html2canvas(root, {
        backgroundColor: "#000000",
        logging: false,
        useCORS: true,
      });
      return canvasToBlob(canvas);
    };

    onCaptureReady(captureScene);
    return () => {
      onCaptureReady(null);
    };
  }, [onCaptureReady]);

  return (
    <div
      ref={rootRef}
      className="video-mode-container"
      onClick={handleToggleMute}
      onKeyDown={handleKeyToggle}
      role="button"
      tabIndex={0}
      aria-pressed={!isMuted}
    >
      {videoUrl ? (
        <video
          src={videoUrl}
          className="video-mode-video"
          autoPlay
          muted={isMuted}
          loop={loopEnabled}
          playsInline
          preload="auto"
          onError={handleRecoverVideo}
          ref={videoRef}
        />
      ) : (
        <div className="video-mode-placeholder">請在網址加上 ?video=檔名.mp4</div>
      )}
    </div>
  );
}
