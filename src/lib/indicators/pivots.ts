import type { Candle } from '../types';

export interface Pivot {
  index: number;
  price: number;
  type: 'high' | 'low';
  /** First bar at which the pivot is known (index + right). */
  confirmIndex: number;
}

/**
 * Swing pivots: a bar whose high (low) is the extreme of the `left` bars before it
 * and the `right` bars after it. Pivots are only confirmed `right` bars later.
 */
export function findPivots(candles: Candle[], left: number, right = left): Pivot[] {
  const pivots: Pivot[] = [];
  for (let i = left; i < candles.length - right; i++) {
    const { high, low } = candles[i];
    let isHigh = true;
    let isLow = true;
    for (let j = i - left; j <= i + right && (isHigh || isLow); j++) {
      if (j === i) continue;
      const c = candles[j];
      // Strict on the left so equal highs/lows do not produce duplicate pivots.
      if (j < i ? c.high >= high : c.high > high) isHigh = false;
      if (j < i ? c.low <= low : c.low < low) isLow = false;
    }
    if (isHigh) pivots.push({ index: i, price: high, type: 'high', confirmIndex: i + right });
    if (isLow) pivots.push({ index: i, price: low, type: 'low', confirmIndex: i + right });
  }
  return pivots;
}
