/**
 * Moving averages. All series functions return an array aligned with the input,
 * with NaN for bars that do not have enough history yet.
 */

/** Simple moving average; a window containing NaN yields NaN. */
export function sma(values: number[], period: number): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  let sum = 0;
  let invalid = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (Number.isFinite(v)) sum += v;
    else invalid++;
    if (i >= period) {
      const old = values[i - period];
      if (Number.isFinite(old)) sum -= old;
      else invalid--;
    }
    if (i >= period - 1 && invalid === 0) out[i] = sum / period;
  }
  return out;
}

/**
 * Mean of the last `period` values, using fewer values while history is short
 * (at least `minPeriods`). Leading NaN values are skipped.
 */
export function rollingMean(values: number[], period: number, minPeriods = 1): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  let sum = 0;
  let count = 0;
  let start = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!Number.isFinite(v)) {
      sum = 0;
      count = 0;
      start = i + 1;
      continue;
    }
    sum += v;
    count++;
    if (count > period) {
      sum -= values[i - period];
      count--;
    }
    if (count >= minPeriods && i >= start) out[i] = sum / count;
  }
  return out;
}

/** Exponential moving average seeded with the SMA of the first `period` valid values. */
export function ema(values: number[], period: number): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  const start = values.findIndex((v) => Number.isFinite(v));
  if (start < 0 || values.length - start < period) return out;

  const k = 2 / (period + 1);
  let seed = 0;
  for (let i = start; i < start + period; i++) seed += values[i];
  let prev = seed / period;
  out[start + period - 1] = prev;
  for (let i = start + period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}
