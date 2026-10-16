import type { Pivot } from './pivots';

export const FIB_RETRACEMENTS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1] as const;
export const FIB_EXTENSIONS = [1.272, 1.618] as const;
export const GOLDEN_RATIOS = [0.5, 0.618, 0.786] as const;

export interface FibLevel {
  ratio: number;
  price: number;
  golden: boolean;
  extension: boolean;
}

export interface FibResult {
  /** 'up': the leg ran low -> high, so retracements are measured down from the high. */
  direction: 'up' | 'down';
  swingHigh: { index: number; price: number };
  swingLow: { index: number; price: number };
  levels: FibLevel[];
  /** Price band between the 0.5 and 0.786 retracements. */
  goldenZone: { top: number; bottom: number };
}

/**
 * Auto Fibonacci: anchors on the highest confirmed swing high and lowest confirmed
 * swing low within `lookback` bars of `atIndex`. Only pivots confirmed by `atIndex`
 * are used, so the result never looks into the future.
 */
export function autoFibonacci(pivots: Pivot[], atIndex: number, lookback = 150): FibResult | null {
  let high: Pivot | null = null;
  let low: Pivot | null = null;
  for (const p of pivots) {
    if (p.confirmIndex > atIndex || p.index < atIndex - lookback) continue;
    if (p.type === 'high' && (!high || p.price > high.price)) high = p;
    if (p.type === 'low' && (!low || p.price < low.price)) low = p;
  }
  if (!high || !low || high.price <= low.price) return null;

  const range = high.price - low.price;
  const direction = low.index < high.index ? 'up' : 'down';
  const retrace = (r: number) => (direction === 'up' ? high!.price - r * range : low!.price + r * range);
  const extend = (r: number) => (direction === 'up' ? low!.price + r * range : high!.price - r * range);

  const levels: FibLevel[] = [
    ...FIB_RETRACEMENTS.map((ratio) => ({
      ratio,
      price: retrace(ratio),
      golden: (GOLDEN_RATIOS as readonly number[]).includes(ratio),
      extension: false,
    })),
    ...FIB_EXTENSIONS.map((ratio) => ({ ratio, price: extend(ratio), golden: false, extension: true })),
  ];

  const a = retrace(0.5);
  const b = retrace(0.786);
  return {
    direction,
    swingHigh: { index: high.index, price: high.price },
    swingLow: { index: low.index, price: low.price },
    levels,
    goldenZone: { top: Math.max(a, b), bottom: Math.min(a, b) },
  };
}
