import type { Candle, Direction } from '../types';
import { findPivots } from './pivots';

export interface Divergence {
  direction: Direction;
  startIndex: number;
  endIndex: number;
  /** Bar at which the second pivot is confirmed and the divergence is known. */
  confirmIndex: number;
  priceStart: number;
  priceEnd: number;
  rsiStart: number;
  rsiEnd: number;
}

export interface DivergenceConfig {
  left: number;
  right: number;
  minBars: number;
  maxBars: number;
}

export const DEFAULT_DIVERGENCE: DivergenceConfig = { left: 5, right: 3, minBars: 5, maxBars: 60 };

/**
 * Regular RSI divergences between consecutive price pivots:
 * - bullish: price makes a lower low while RSI makes a higher low
 * - bearish: price makes a higher high while RSI makes a lower high
 */
export function rsiDivergences(
  candles: Candle[],
  rsiValues: number[],
  config: Partial<DivergenceConfig> = {},
): Divergence[] {
  const { left, right, minBars, maxBars } = { ...DEFAULT_DIVERGENCE, ...config };
  const pivots = findPivots(candles, left, right);
  const out: Divergence[] = [];

  for (const type of ['low', 'high'] as const) {
    const list = pivots.filter((p) => p.type === type);
    for (let k = 1; k < list.length; k++) {
      const a = list[k - 1];
      const b = list[k];
      const bars = b.index - a.index;
      if (bars < minBars || bars > maxBars) continue;
      const ra = rsiValues[a.index];
      const rb = rsiValues[b.index];
      if (!Number.isFinite(ra) || !Number.isFinite(rb)) continue;

      const bullish = type === 'low' && b.price < a.price && rb > ra;
      const bearish = type === 'high' && b.price > a.price && rb < ra;
      if (!bullish && !bearish) continue;

      out.push({
        direction: bullish ? 'bullish' : 'bearish',
        startIndex: a.index,
        endIndex: b.index,
        confirmIndex: b.confirmIndex,
        priceStart: a.price,
        priceEnd: b.price,
        rsiStart: ra,
        rsiEnd: rb,
      });
    }
  }

  return out.sort((x, y) => x.confirmIndex - y.confirmIndex);
}
