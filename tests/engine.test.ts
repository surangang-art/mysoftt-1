import { describe, expect, it } from 'vitest';
import { generateDemoCandles } from '@/lib/data/demo';
import { mergeCandles } from '@/lib/data/merge';
import { DEFAULT_ENGINE_CONFIG } from '@/lib/signals/config';
import { classify, computeLevels, runEngine } from '@/lib/signals/engine';
import { TIMEFRAMES } from '@/lib/types';

const core = (n: number) => ({ nadaraya: n > 0, rsi: n > 1, orderBlock: n > 2 });

describe('classify', () => {
  const cfg = DEFAULT_ENGINE_CONFIG;
  it('requires full core confluence for STRONG signals', () => {
    expect(classify(cfg, 80, 10, core(3), core(0))).toBe('STRONG BUY');
    expect(classify(cfg, 80, 10, core(2), core(0))).toBe('BUY');
    expect(classify(cfg, 10, 85, core(0), core(3))).toBe('STRONG SELL');
  });
  it('stays neutral without enough edge or core conditions', () => {
    expect(classify(cfg, 60, 50, core(3), core(0))).toBe('NEUTRAL');
    expect(classify(cfg, 60, 10, core(0), core(0))).toBe('NEUTRAL');
    expect(classify(cfg, 40, 0, core(3), core(0))).toBe('NEUTRAL');
  });
});

describe('computeLevels', () => {
  it('orders long levels SL < entry < TP1 < TP2 < TP3 and clamps the stop', () => {
    const l = computeLevels(DEFAULT_ENGINE_CONFIG, 2000, 5, 'long', [], null);
    expect(l.stopLoss).toBeLessThan(l.entry);
    expect(l.tp1).toBeGreaterThan(l.entry);
    expect(l.tp2).toBeGreaterThan(l.tp1);
    expect(l.tp3).toBeGreaterThan(l.tp2);
    const risk = l.entry - l.stopLoss;
    expect(risk).toBeGreaterThanOrEqual(5);
    expect(risk).toBeLessThanOrEqual(15);
    expect(l.rr).toEqual([1, 2, 3]);
  });

  it('places a short stop beyond a bearish order block', () => {
    const zone = {
      id: 'z',
      kind: 'OB' as const,
      direction: 'bearish' as const,
      top: 2008,
      bottom: 2003,
      startIndex: 0,
      startTime: 0,
      createdIndex: 0,
    };
    const l = computeLevels(DEFAULT_ENGINE_CONFIG, 2000, 4, 'short', [zone], null);
    expect(l.stopLoss).toBeCloseTo(2009);
    expect(l.tp1).toBeLessThan(2000);
    expect(l.tp3).toBeLessThan(l.tp2);
  });
});

describe('runEngine on the demo feed', () => {
  it.each(TIMEFRAMES)('produces consistent output for %s', (tf) => {
    const candles = generateDemoCandles(tf, 500, Date.UTC(2026, 0, 15, 12));
    const out = runEngine(candles);
    expect(out.latest).not.toBeNull();
    expect(out.series.ema20).toHaveLength(500);
    for (const s of out.signals) {
      expect(s.signal).not.toBe('NEUTRAL');
      expect(s.levels).not.toBeNull();
      const l = s.levels!;
      const dir = l.side === 'long' ? 1 : -1;
      expect((l.entry - l.stopLoss) * dir).toBeGreaterThan(0);
      expect((l.tp1 - l.entry) * dir).toBeGreaterThan(0);
      expect((l.tp2 - l.tp1) * dir).toBeGreaterThan(0);
      expect((l.tp3 - l.tp2) * dir).toBeGreaterThan(0);
    }
  });

  it('does not repaint past signals when new bars arrive', () => {
    const candles = generateDemoCandles('5m', 500, Date.UTC(2026, 0, 15, 12));
    const prefix = candles.slice(0, 420);
    const lastTime = prefix[prefix.length - 1].time;
    const before = runEngine(prefix).signals.map((s) => s.id);
    const after = runEngine(candles)
      .signals.filter((s) => s.time <= lastTime)
      .map((s) => s.id);
    expect(after).toEqual(before);
  });

  it('demo history is stable between polls', () => {
    const t = Date.UTC(2026, 0, 15, 12);
    const a = generateDemoCandles('1m', 100, t);
    const b = generateDemoCandles('1m', 100, t + 125_000);
    const merged = mergeCandles(a, b.slice(-5));
    expect(merged.length).toBe(102);
    expect(b.find((c) => c.time === a[50].time)).toEqual(a[50]);
  });
});
