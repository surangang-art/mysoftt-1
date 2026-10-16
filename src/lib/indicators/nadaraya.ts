import { rollingMean } from './ma';

export interface NadarayaConfig {
  /** Gaussian kernel bandwidth (h). */
  bandwidth: number;
  /** Envelope width as a multiple of the mean absolute error. */
  mult: number;
  /** Lookback used for the kernel and the error average. */
  window: number;
}

export interface NadarayaResult {
  mid: number[];
  upper: number[];
  lower: number[];
}

export const DEFAULT_NADARAYA: NadarayaConfig = { bandwidth: 8, mult: 3, window: 500 };

/**
 * Nadaraya-Watson envelope, endpoint (non-repainting) variant.
 *
 * Each bar's estimate is a Gaussian-kernel weighted average of the bars up to and
 * including it, so historical values never change when new bars arrive. The
 * envelope is the estimate +/- mult * mean(|src - estimate|), matching the
 * construction popularised by the LuxAlgo indicator.
 */
export function nadarayaWatsonEnvelope(
  src: number[],
  config: Partial<NadarayaConfig> = {},
): NadarayaResult {
  const { bandwidth, mult, window } = { ...DEFAULT_NADARAYA, ...config };
  const n = src.length;

  // Gaussian weights decay fast; ignore the tail that contributes nothing.
  const weights: number[] = [];
  for (let j = 0; j < window; j++) {
    const w = Math.exp(-(j * j) / (2 * bandwidth * bandwidth));
    if (w < 1e-8) break;
    weights.push(w);
  }

  const mid = new Array<number>(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    let wsum = 0;
    const span = Math.min(weights.length, i + 1);
    for (let j = 0; j < span; j++) {
      sum += src[i - j] * weights[j];
      wsum += weights[j];
    }
    mid[i] = sum / wsum;
  }

  const err = src.map((v, i) => Math.abs(v - mid[i]));
  const mae = rollingMean(err, window - 1, 20).map((v) => v * mult);

  return {
    mid,
    upper: mid.map((v, i) => v + mae[i]),
    lower: mid.map((v, i) => v - mae[i]),
  };
}
