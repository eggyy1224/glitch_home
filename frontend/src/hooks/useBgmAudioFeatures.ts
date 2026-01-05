import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { fetchBgmAssets, type BgmTrackEntry } from "../api/media";
import {
  type AudioBands,
  type AudioFeatures,
  type BeatState,
  computeBandsAndCentroid,
  computeRmsAndPeak,
  createInitialBeatState,
  createInitialFeatures,
  detectBeat,
  getAudioContext,
} from "./audioAnalysis";

export type BgmAudioFeatures = AudioFeatures;

export interface UseBgmAudioFeaturesOptions {
  /** Initial BGM file to play (filename from /bgm/) */
  bgmFile?: string | null;
  /** Volume 0-1, default 0.6 */
  volume?: number;
  /** Auto-start playback when ready */
  autoStart?: boolean;
}

export interface UseBgmAudioFeaturesResult {
  featuresRef: React.MutableRefObject<BgmAudioFeatures>;
  features: BgmAudioFeatures;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  currentTrack: string | null;
  playlist: BgmTrackEntry[];
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
  nextTrack: () => void;
  prevTrack: () => void;
  setVolume: (vol: number) => void;
}

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

const formatPlayError = (error: unknown): string => {
  if (!error) return "unknown";
  if (error instanceof Error) {
    return error.message || error.name || "unknown";
  }
  if (typeof error === "string") return error;
  return "unknown";
};

const waitForPlayable = (audio: HTMLAudioElement, timeoutMs = 2000): Promise<void> => {
  if (audio.readyState >= 2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      audio.removeEventListener("canplay", handleReady);
      audio.removeEventListener("loadeddata", handleReady);
      audio.removeEventListener("error", handleError);
      if (timer) window.clearTimeout(timer);
    };
    const handleReady = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const handleError = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("BGM 載入失敗"));
    };
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    }, timeoutMs);
    audio.addEventListener("canplay", handleReady);
    audio.addEventListener("loadeddata", handleReady);
    audio.addEventListener("error", handleError);
  });
};

export function useBgmAudioFeatures(options: UseBgmAudioFeaturesOptions = {}): UseBgmAudioFeaturesResult {
  const { bgmFile = null, volume: initialVolume = 0.6, autoStart = false } = options;

  const [running, setRunning] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [beatCount, setBeatCount] = useState(0);
  const [beatPulse, setBeatPulse] = useState(false);
  const [playlist, setPlaylist] = useState<BgmTrackEntry[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [volume, setVolumeState] = useState(initialVolume);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const beatPulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sourceConnectedRef = useRef(false);

  const timeDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const freqDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  const rmsRef = useRef(0);
  const peakRef = useRef(0);
  const bandsRef = useRef<AudioBands>({ low: 0, mid: 0, high: 0 });
  const centroidRef = useRef(0);
  const beatAtRef = useRef<number | null>(null);

  const beatStateRef = useRef<BeatState>(createInitialBeatState(60));
  const featuresRef = useRef<BgmAudioFeatures>(createInitialFeatures());

  const currentTrack = useMemo(() => {
    if (!playlist.length) return null;
    const idx = Math.max(0, Math.min(currentTrackIndex, playlist.length - 1));
    return playlist[idx]?.filename || null;
  }, [playlist, currentTrackIndex]);

  const currentTrackUrl = useMemo(() => {
    if (!playlist.length) return null;
    const idx = Math.max(0, Math.min(currentTrackIndex, playlist.length - 1));
    return playlist[idx]?.url || null;
  }, [playlist, currentTrackIndex]);

  // Load playlist on mount
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { tracks } = await fetchBgmAssets();
        if (cancelled) return;
        setPlaylist(tracks);

        // Find initial track index if bgmFile is specified
        if (bgmFile && tracks.length) {
          const idx = tracks.findIndex((t) => t.filename === bgmFile);
          if (idx >= 0) {
            setCurrentTrackIndex(idx);
          }
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "載入 BGM 清單失敗");
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [bgmFile]);

  // Create audio element once
  useEffect(() => {
    if (!audioRef.current) {
      const audio = document.createElement("audio");
      audio.crossOrigin = "anonymous";
      audio.preload = "auto";
      audioRef.current = audio;
    }
    return () => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.src = "";
      }
    };
  }, []);

  // Update audio source when track changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrackUrl) return;
    audio.src = currentTrackUrl;
    audio.load();
    
    // Auto-play if running and either already playing or transitioning from previous track
    if (running && (isPlaying || isTransitioningRef.current)) {
      audio.play()
        .then(() => {
          isTransitioningRef.current = false;
          setIsPlaying(true);
        })
        .catch(() => {
          isTransitioningRef.current = false;
        });
    }
  }, [currentTrackUrl, running, isPlaying]);

  // Update volume
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = Math.max(0, Math.min(1, volume));
    }
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = Math.max(0, Math.min(1, volume));
    }
  }, [volume]);

  const setVolume = useCallback((vol: number) => {
    setVolumeState(Math.max(0, Math.min(1, vol)));
  }, []);

  const nextTrack = useCallback(() => {
    if (!playlist.length) return;
    setCurrentTrackIndex((prev) => (prev + 1) % playlist.length);
  }, [playlist.length]);

  const prevTrack = useCallback(() => {
    if (!playlist.length) return;
    setCurrentTrackIndex((prev) => (prev - 1 + playlist.length) % playlist.length);
  }, [playlist.length]);

  // Track whether we're transitioning between tracks (to auto-play next)
  const isTransitioningRef = useRef(false);

  // Handle track ended - auto advance to next
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    const handleEnded = () => {
      // Mark that we're transitioning so next track auto-plays
      isTransitioningRef.current = true;
      nextTrack();
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => {
      // Only set isPlaying to false if we're not transitioning between tracks
      if (!isTransitioningRef.current) {
        setIsPlaying(false);
      }
    };
    const handleError = () => {
      setError(`BGM 載入失敗：${currentTrack || "unknown"}`);
      // Auto skip to next track on error
      isTransitioningRef.current = true;
      setTimeout(() => nextTrack(), 500);
    };

    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("error", handleError);
    };
  }, [nextTrack, currentTrack]);

  const stop = useCallback(() => {
    setRunning(false);
    setIsPlaying(false);

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (beatPulseTimerRef.current) {
      clearTimeout(beatPulseTimerRef.current);
      beatPulseTimerRef.current = null;
    }
    setBeatPulse(false);

    const audio = audioRef.current;
    if (audio) {
      audio.pause();
    }

    // Don't close AudioContext to allow restarting
    // Just disconnect the source if needed
    analyserRef.current = null;
    beatAtRef.current = null;
    featuresRef.current = {
      ...createInitialFeatures(),
      beatCount: beatStateRef.current.beatCount,
    };
  }, []);

  useEffect(() => stop, [stop]);

  const start = useCallback(async () => {
    if (running) return;
    setError(null);
    beatAtRef.current = null;

    const audio = audioRef.current;
    if (!audio) {
      setError("音訊元素未初始化");
      return;
    }

    if (!playlist.length) {
      setError("BGM 清單為空，請確認 /bgm/ 資料夾有音檔");
      return;
    }

    try {
      const AudioContextCtor = getAudioContext();
      if (!AudioContextCtor) {
        setError("此瀏覽器不支援 AudioContext。");
        return;
      }

      // Reuse existing context or create new
      let ctx = audioContextRef.current;
      if (!ctx || ctx.state === "closed") {
        ctx = new AudioContextCtor();
        audioContextRef.current = ctx;
        sourceConnectedRef.current = false;
      }

      // Resume if suspended
      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      // Create analyser
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.75;
      analyserRef.current = analyser;

      // Create gain node for volume control
      let gainNode = gainNodeRef.current;
      if (!gainNode || !sourceConnectedRef.current) {
        gainNode = ctx.createGain();
        gainNode.gain.value = volume;
        gainNodeRef.current = gainNode;
      }

      // Connect audio element to analyser (only once per audio element)
      if (!sourceConnectedRef.current) {
        const source = ctx.createMediaElementSource(audio);
        sourceNodeRef.current = source;
        source.connect(gainNode);
        gainNode.connect(analyser);
        analyser.connect(ctx.destination);
        sourceConnectedRef.current = true;
      } else {
        // Reconnect gain to new analyser
        if (gainNodeRef.current) {
          gainNodeRef.current.disconnect();
          gainNodeRef.current.connect(analyser);
          analyser.connect(ctx.destination);
        }
      }

      timeDataRef.current = new Uint8Array(analyser.fftSize);
      freqDataRef.current = new Uint8Array(analyser.frequencyBinCount);

      beatStateRef.current = createInitialBeatState(60);

      setRunning(true);
      featuresRef.current = {
        running: true,
        sampleRate: ctx.sampleRate,
        rms: 0,
        peak: 0,
        bands: { low: 0, mid: 0, high: 0 },
        centroid: 0,
        beat: false,
        beatCount: 0,
        beatAt: null,
      };

      if (currentTrackUrl && audio.src !== currentTrackUrl) {
        audio.src = currentTrackUrl;
        audio.load();
      }

      const tryPlay = async (): Promise<boolean> => {
        let lastError: unknown = null;
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            await waitForPlayable(audio, 2000);
            await audio.play();
            setIsPlaying(true);
            setError(null);
            return true;
          } catch (playErr) {
            lastError = playErr;
            if (isAutoplayBlockedError(playErr)) {
              setError("自動播放被阻擋，請點擊頁面後重試");
              stop();
              return false;
            }
            if (attempt === 0) {
              await new Promise((resolve) => window.setTimeout(resolve, 200));
              continue;
            }
          }
        }
        setError(`BGM 播放失敗：${formatPlayError(lastError)}`);
        stop();
        return false;
      };

      const didPlay = await tryPlay();
      if (!didPlay) {
        return;
      }

      const tick = () => {
        const activeAnalyser = analyserRef.current;
        const ctxNow = audioContextRef.current;
        const timeData = timeDataRef.current;
        const freqData = freqDataRef.current;
        if (!activeAnalyser || !ctxNow || !timeData || !freqData) {
          rafRef.current = null;
          return;
        }

        activeAnalyser.getByteTimeDomainData(timeData);
        activeAnalyser.getByteFrequencyData(freqData);

        const { rms, peak } = computeRmsAndPeak(timeData);
        rmsRef.current = rms;
        peakRef.current = peak;

        const { bands, centroid } = computeBandsAndCentroid(freqData, ctxNow.sampleRate);
        bandsRef.current = bands;
        centroidRef.current = centroid;

        const now = performance.now();
        const beatState = beatStateRef.current;
        const shouldBeat = detectBeat(rms, beatState, now);

        if (shouldBeat) {
          beatAtRef.current = now;
          setBeatCount(beatState.beatCount);
          setBeatPulse(true);
          if (beatPulseTimerRef.current) {
            clearTimeout(beatPulseTimerRef.current);
          }
          beatPulseTimerRef.current = setTimeout(() => {
            beatPulseTimerRef.current = null;
            setBeatPulse(false);
          }, 90);
        }

        featuresRef.current = {
          running: true,
          sampleRate: ctxNow.sampleRate,
          rms: rmsRef.current,
          peak: peakRef.current,
          bands: bandsRef.current,
          centroid: centroidRef.current,
          beat: shouldBeat,
          beatCount: beatState.beatCount,
          beatAt: beatAtRef.current,
        };

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      const message = err instanceof Error ? err.message : "BGM 啟動失敗";
      setError(message);
      stop();
    }
  }, [currentTrackUrl, running, stop, playlist.length, volume]);

  // Auto-start if requested and playlist is loaded
  const autoStartAttemptedRef = useRef(false);
  useEffect(() => {
    if (!autoStart) return;
    if (!playlist.length) return;
    if (running) return;
    if (autoStartAttemptedRef.current) return;
    autoStartAttemptedRef.current = true;

    void start();
  }, [autoStart, playlist.length, running, start]);

  const features = useMemo<BgmAudioFeatures>(() => {
    return {
      running,
      sampleRate: featuresRef.current.sampleRate,
      rms: featuresRef.current.rms,
      peak: featuresRef.current.peak,
      bands: featuresRef.current.bands,
      centroid: featuresRef.current.centroid,
      beat: beatPulse,
      beatCount,
      beatAt: featuresRef.current.beatAt,
    };
  }, [running, beatPulse, beatCount]);

  return {
    featuresRef,
    features,
    error,
    start,
    stop,
    currentTrack,
    playlist,
    audioRef,
    isPlaying,
    nextTrack,
    prevTrack,
    setVolume,
  };
}
