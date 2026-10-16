import type { Candle } from '../types';

/** Merge `updates` into `existing` by bar time (updates win), keeping the newest `max` bars. */
export function mergeCandles(existing: Candle[], updates: Candle[], max = 1000): Candle[] {
  if (!updates.length) return existing;
  const byTime = new Map<number, Candle>();
  for (const c of existing) byTime.set(c.time, c);
  for (const c of updates) byTime.set(c.time, c);
  const merged = Array.from(byTime.values()).sort((a, b) => a.time - b.time);
  return merged.length > max ? merged.slice(merged.length - max) : merged;
}
