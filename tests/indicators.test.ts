import { describe, expect, it } from 'vitest';
import {
  atr,
  autoFibonacci,
  ema,
  findPivots,
  macd,
  nadarayaWatsonEnvelope,
  rsi,
  rsiDivergences,
  sma,
  smartMoneyConcepts,
} from '@/lib/indicators';
import type { Candle } from '@/lib/types';

const bar = (i: number, o: number, h: number, l: number, c: number): Candle => ({
  time: i * 60,
  open: o,
  high: h,
  low: l,
  close: c,
});

/** Candles following a list of closes with fixed wicks. */
const fromCloses = (closes: number[], wick = 0.5): Candle[] =>
  closes.map((c, i) => bar(i, i ? closes[i - 1] : c, Math.max(c, i ? closes[i - 1] : c) + wick, Math.min(c, i ? closes[i - 1] : c) - wick, c));

describe('moving averages', () => {
  it('computes SMA and EMA', () => {
    const v = [1, 2, 3, 4, 5, 6];
    expect(sma(v, 3).slice(2)).toEqual([2, 3, 4, 5]);
    const e = ema(v, 3);
    expect(e[1]).toBeNaN();
    expect(e[2]).toBe(2);
    expect(e[3]).toBe(3);
    expect(e[5]).toBe(5);
  });

  it('EMA skips leading NaN values', () => {
    const e = ema([NaN, NaN, 2, 4, 6], 2);
    expect(e[3]).toBe(3);
    expect(e[4]).toBeCloseTo(5);
  });
});

describe('RSI', () => {
  it('is 100 for a strictly rising series and 0 for a falling one', () => {
    const up = Array.from({ length: 30 }, (_, i) => 100 + i);
    expect(rsi(up, 14)[29]).toBe(100);
    expect(rsi([...up].reverse(), 14)[29]).toBe(0);
  });

  it('matches the Wilder reference values', () => {
    // Classic example from Wilder / StockCharts.
    const closes = [
      44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.0,
      46.03, 46.41, 46.22, 45.64,
    ];
    const r = rsi(closes, 14);
    expect(r[14]).toBeCloseTo(70.46, 1);
    expect(r[19]).toBeCloseTo(57.92, 0);
  });
});

describe('MACD and ATR', () => {
  it('MACD histogram is positive in an accelerating uptrend', () => {
    const closes = Array.from({ length: 80 }, (_, i) => 100 + i * i * 0.01);
    const m = macd(closes);
    expect(m.macd[79]).toBeGreaterThan(0);
    expect(m.histogram[79]).toBeGreaterThan(0);
  });

  it('ATR equals the constant range of identical bars', () => {
    const candles = Array.from({ length: 30 }, (_, i) => bar(i, 10, 11, 9, 10));
    const a = atr(candles, 14);
    expect(a[12]).toBeNaN();
    expect(a[29]).toBeCloseTo(2);
  });
});

describe('Nadaraya-Watson envelope', () => {
  it('tracks a flat series and does not repaint', () => {
    const src = Array.from({ length: 120 }, (_, i) => 100 + Math.sin(i / 5));
    const full = nadarayaWatsonEnvelope(src);
    const partial = nadarayaWatsonEnvelope(src.slice(0, 100));
    expect(full.mid[99]).toBeCloseTo(partial.mid[99], 10);
    expect(full.upper[119]).toBeGreaterThan(full.mid[119]);
    expect(full.lower[119]).toBeLessThan(full.mid[119]);
  });
});

describe('Smart Money Concepts', () => {
  it('detects a bullish FVG', () => {
    const candles = [bar(0, 100, 101, 99, 100.5), bar(1, 100.5, 104, 100.4, 103.8), bar(2, 103.8, 105, 102, 104.5)];
    const { fvgs } = smartMoneyConcepts(candles);
    expect(fvgs).toHaveLength(1);
    expect(fvgs[0]).toMatchObject({ direction: 'bullish', top: 102, bottom: 101 });
  });

  it('detects BOS then CHoCH with an order block', () => {
    // Rise to a swing high, pull back, break it (BOS), then collapse below the swing low (CHoCH).
    const closes = [
      ...Array.from({ length: 10 }, (_, i) => 100 + i), // up to 109
      ...Array.from({ length: 8 }, (_, i) => 108 - i), // down to 101
      ...Array.from({ length: 12 }, (_, i) => 102 + i * 1.2), // break above 109.5
      ...Array.from({ length: 25 }, (_, i) => 114 - i * 1.5), // collapse
    ];
    const smc = smartMoneyConcepts(fromCloses(closes), { swingLength: 3 });
    const types = smc.structures.map((s) => `${s.type}:${s.direction}`);
    expect(types).toContain('BOS:bullish');
    expect(types).toContain('CHoCH:bearish');
    expect(smc.orderBlocks.some((z) => z.direction === 'bullish')).toBe(true);
    expect(smc.trend[smc.trend.length - 1]).toBe(-1);
  });
});

describe('pivots, divergence and Fibonacci', () => {
  it('finds a bullish RSI divergence on a lower low with weaker momentum', () => {
    const closes = [
      ...Array.from({ length: 20 }, (_, i) => 120 - i * 1.5), // sharp drop to ~91.5
      ...Array.from({ length: 10 }, (_, i) => 92 + i * 0.8), // bounce
      ...Array.from({ length: 12 }, (_, i) => 99 - i * 0.7), // slow grind to a lower low
      ...Array.from({ length: 10 }, (_, i) => 91 + i), // recovery
    ];
    const candles = fromCloses(closes, 0.1);
    const divs = rsiDivergences(candles, rsi(closes, 14));
    expect(divs.some((d) => d.direction === 'bullish' && d.priceEnd < d.priceStart)).toBe(true);
  });

  it('anchors Fibonacci on the swing extremes', () => {
    const closes = [
      ...Array.from({ length: 6 }, (_, i) => 106 - i), // dip to a swing low at 101
      ...Array.from({ length: 20 }, (_, i) => 102 + i), // rally to 121
      ...Array.from({ length: 15 }, (_, i) => 120 - i * 0.6), // pullback
    ];
    const candles = fromCloses(closes, 0);
    const pivots = findPivots(candles, 3);
    const fib = autoFibonacci(pivots, candles.length - 1);
    expect(fib).not.toBeNull();
    expect(fib!.direction).toBe('up');
    const l618 = fib!.levels.find((l) => l.ratio === 0.618)!;
    const range = fib!.swingHigh.price - fib!.swingLow.price;
    expect(l618.price).toBeCloseTo(fib!.swingHigh.price - 0.618 * range);
    expect(l618.golden).toBe(true);
  });
});
