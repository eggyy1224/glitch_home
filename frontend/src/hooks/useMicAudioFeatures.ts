import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";

export type MicBands = {
  low: number;
  mid: number;
  high: number;
};

export type MicAudioFeatures = {
  running: boolean;
  sampleRate: number | null;
  rms: number;
  peak: number;
  bands: MicBands;
  centroid: number;
  beat: boolean;
  beatCount: number;
  beatAt: number | null;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const normalizeByte = (value: number) => clamp01(value / 255);

const computeRmsAndPeak = (timeData: Uint8Array): { rms: number; peak: number } => {
  if (!timeData.length) return { rms: 0, peak: 0 };
  let sumSquares = 0;
  let peak = 0;
  for (let i = 0; i < timeData.length; i += 1) {
    const normalized = (timeData[i] - 128) / 128;
    const abs = Math.abs(normalized);
    if (abs > peak) peak = abs;
    sumSquares += normalized * normalized;
  }
  const rms = Math.sqrt(sumSquares / timeData.length);
  return { rms: clamp01(rms), peak: clamp01(peak) };
};

type BeatState = {
  lastEnergy: number;
  lastBeatAt: number;
  history: number[];
  historySize: number;
  beatCount: number;
};

const computeMeanAndStd = (values: number[]): { mean: number; std: number } => {
  if (!values.length) return { mean: 0, std: 0 };
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) sum += values[i];
  const mean = sum / values.length;
  let varianceSum = 0;
  for (let i = 0; i < values.length; i += 1) {
    const d = values[i] - mean;
    varianceSum += d * d;
  }
  const std = Math.sqrt(varianceSum / values.length);
  return { mean, std };
};

const computeBandsAndCentroid = (
  freqData: Uint8Array,
  sampleRate: number,
): { bands: MicBands; centroid: number } => {
  const n = freqData.length;
  if (!n || !sampleRate) return { bands: { low: 0, mid: 0, high: 0 }, centroid: 0 };
  const nyquist = sampleRate / 2;
  const binHz = nyquist / n;

  const lowMaxHz = 160;
  const midMaxHz = 2000;
  const highMaxHz = 8000;

  let lowSum = 0;
  let lowCount = 0;
  let midSum = 0;
  let midCount = 0;
  let highSum = 0;
  let highCount = 0;

  let weightedSum = 0;
  let magnitudeSum = 0;

  for (let i = 0; i < n; i += 1) {
    const mag = normalizeByte(freqData[i]);
    const hz = i * binHz;
    if (hz <= lowMaxHz) {
      lowSum += mag;
      lowCount += 1;
    } else if (hz <= midMaxHz) {
      midSum += mag;
      midCount += 1;
    } else if (hz <= highMaxHz) {
      highSum += mag;
      highCount += 1;
    }
    weightedSum += hz * mag;
    magnitudeSum += mag;
  }

  const low = lowCount ? lowSum / lowCount : 0;
  const mid = midCount ? midSum / midCount : 0;
  const high = highCount ? highSum / highCount : 0;
  const centroidHz = magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
  const centroid = clamp01(centroidHz / highMaxHz);

  return { bands: { low: clamp01(low), mid: clamp01(mid), high: clamp01(high) }, centroid };
};

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

  const timeDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const freqDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  const rmsRef = useRef(0);
  const peakRef = useRef(0);
  const bandsRef = useRef<MicBands>({ low: 0, mid: 0, high: 0 });
  const centroidRef = useRef(0);
  const beatAtRef = useRef<number | null>(null);

  const beatStateRef = useRef<BeatState>({
    lastEnergy: 0,
    lastBeatAt: 0,
    history: [],
    historySize: 60,
    beatCount: 0,
  });

  const featuresRef = useRef<MicAudioFeatures>({
    running: false,
    sampleRate: null,
    rms: 0,
    peak: 0,
    bands: { low: 0, mid: 0, high: 0 },
    centroid: 0,
    beat: false,
    beatCount: 0,
    beatAt: null,
  });

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
      running: false,
      sampleRate: null,
      rms: 0,
      peak: 0,
      bands: { low: 0, mid: 0, high: 0 },
      centroid: 0,
      beat: false,
      beatCount: beatStateRef.current.beatCount,
      beatAt: null,
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

      const AudioContextCtor =
        (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
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

      beatStateRef.current = {
        lastEnergy: 0,
        lastBeatAt: performance.now(),
        history: [],
        historySize: 60,
        beatCount: 0,
      };

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
        const energy = rms;
        const beatState = beatStateRef.current;
        const delta = energy - beatState.lastEnergy;
        beatState.lastEnergy = energy;
        beatState.history.push(energy);
        if (beatState.history.length > beatState.historySize) {
          beatState.history.shift();
        }

        const { mean, std } = computeMeanAndStd(beatState.history);
        const minIntervalMs = 120;
        const energyGate = Math.max(0.04, mean + std * 0.7);
        const deltaGate = Math.max(0.01, std * 0.35);

        const shouldBeat = delta > deltaGate && energy > energyGate && now - beatState.lastBeatAt > minIntervalMs;
        if (shouldBeat) {
          beatState.lastBeatAt = now;
          beatState.beatCount += 1;
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
