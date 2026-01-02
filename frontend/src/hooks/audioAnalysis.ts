/**
 * Shared audio analysis utilities for microphone and BGM audio features.
 */

export type AudioBands = {
  low: number;
  mid: number;
  high: number;
};

export type AudioFeatures = {
  running: boolean;
  sampleRate: number | null;
  rms: number;
  peak: number;
  bands: AudioBands;
  centroid: number;
  beat: boolean;
  beatCount: number;
  beatAt: number | null;
};

export type BeatState = {
  lastEnergy: number;
  lastBeatAt: number;
  history: number[];
  historySize: number;
  beatCount: number;
};

export const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const normalizeByte = (value: number): number => clamp01(value / 255);

export const computeRmsAndPeak = (timeData: Uint8Array): { rms: number; peak: number } => {
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

export const computeMeanAndStd = (values: number[]): { mean: number; std: number } => {
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

export const computeBandsAndCentroid = (
  freqData: Uint8Array,
  sampleRate: number,
): { bands: AudioBands; centroid: number } => {
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

/**
 * Detect beat based on energy delta and history.
 * Returns whether a beat was detected and updates beatState in place.
 */
export const detectBeat = (
  energy: number,
  beatState: BeatState,
  now: number,
  options?: { minIntervalMs?: number },
): boolean => {
  const minIntervalMs = options?.minIntervalMs ?? 120;

  const delta = energy - beatState.lastEnergy;
  beatState.lastEnergy = energy;
  beatState.history.push(energy);
  if (beatState.history.length > beatState.historySize) {
    beatState.history.shift();
  }

  const { mean, std } = computeMeanAndStd(beatState.history);
  const energyGate = Math.max(0.04, mean + std * 0.7);
  const deltaGate = Math.max(0.01, std * 0.35);

  const shouldBeat = delta > deltaGate && energy > energyGate && now - beatState.lastBeatAt > minIntervalMs;
  if (shouldBeat) {
    beatState.lastBeatAt = now;
    beatState.beatCount += 1;
  }

  return shouldBeat;
};

export const createInitialBeatState = (historySize = 60): BeatState => ({
  lastEnergy: 0,
  lastBeatAt: 0,
  history: [],
  historySize,
  beatCount: 0,
});

export const createInitialFeatures = (): AudioFeatures => ({
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

export const getAudioContext = (): typeof AudioContext | null => {
  const win = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return win.AudioContext || win.webkitAudioContext || null;
};
