import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
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

// Re-export types for backwards compatibility
export type MicBands = AudioBands;
export type MicAudioFeatures = AudioFeatures;

export function useMicAudioFeatures(): {
  featuresRef: React.MutableRefObject<MicAudioFeatures>;
  features: MicAudioFeatures;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
} {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [beatCount, setBeatCount] = useState(0);
  const [beatPulse, setBeatPulse] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const beatPulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // TS 5.5+ defines Uint8Array as generic over ArrayBufferLike; keep this typing.
  const timeDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const freqDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  const rmsRef = useRef(0);
  const peakRef = useRef(0);
  const bandsRef = useRef<MicBands>({ low: 0, mid: 0, high: 0 });
  const centroidRef = useRef(0);
  const beatAtRef = useRef<number | null>(null);

  const beatStateRef = useRef<BeatState>(createInitialBeatState(60));

  const featuresRef = useRef<MicAudioFeatures>(createInitialFeatures());

  const stop = useCallback(() => {
    setRunning(false);
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (beatPulseTimerRef.current) {
      clearTimeout(beatPulseTimerRef.current);
      beatPulseTimerRef.current = null;
    }
    setBeatPulse(false);
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    streamRef.current = null;
    analyserRef.current = null;

    const ctx = audioContextRef.current;
    audioContextRef.current = null;
    if (ctx && ctx.state !== "closed") {
      void ctx.close().catch(() => undefined);
    }
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

    if (!navigator?.mediaDevices?.getUserMedia) {
      setError("此瀏覽器不支援麥克風輸入（getUserMedia）。");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      });
      streamRef.current = stream;

      const AudioContextCtor = getAudioContext();
      if (!AudioContextCtor) {
        setError("此瀏覽器不支援 AudioContext。");
        stop();
        return;
      }

      const ctx = new AudioContextCtor();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);
      analyserRef.current = analyser;

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
      const message = err instanceof Error ? err.message : "麥克風啟動失敗";
      setError(message);
      stop();
    }
  }, [running, stop]);

  const features = useMemo<MicAudioFeatures>(() => {
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

  return { featuresRef, features, error, start, stop };
}
