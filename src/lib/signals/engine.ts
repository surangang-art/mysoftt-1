import {
  activeZonesAt,
  atr,
  autoFibonacci,
  ema,
  macd,
  nadarayaWatsonEnvelope,
  rsi,
  rsiDivergences,
  smartMoneyConcepts,
  type Divergence,
  type FibResult,
  type NadarayaResult,
  type SmcResult,
  type Zone,
} from '../indicators';
import { isStrongSignal, signalDirection, type Candle, type SignalType } from '../types';
import { DEFAULT_ENGINE_CONFIG, type EngineConfig, type ScoreWeights } from './config';

export interface ComponentScore {
  key: keyof ScoreWeights;
  label: string;
  bull: number;
  bear: number;
  max: number;
  note: string;
}

export interface CoreConfluence {
  nadaraya: boolean;
  rsi: boolean;
  orderBlock: boolean;
}

export interface TradeLevels {
  side: 'long' | 'short';
  entry: number;
  stopLoss: number;
  tp1: number;
  tp2: number;
  tp3: number;
  /** Reward-to-risk ratio of each target. */
  rr: [number, number, number];
}

export interface Analysis {
  index: number;
  time: number;
  price: number;
  signal: SignalType;
  bullScore: number;
  bearScore: number;
  components: ComponentScore[];
  core: { bull: CoreConfluence; bear: CoreConfluence };
  atr: number;
  rsi: number;
  levels: TradeLevels | null;
}

export interface SignalEvent extends Analysis {
  id: string;
}

export interface IndicatorSeries {
  ema20: number[];
  ema50: number[];
  ema200: number[];
  nadaraya: NadarayaResult;
  rsi: number[];
  macd: number[];
  macdSignal: number[];
  macdHistogram: number[];
  atr: number[];
}

export interface EngineOutput {
  series: IndicatorSeries;
  smc: SmcResult;
  divergences: Divergence[];
  /** Analysis of the last bar (which may still be forming). */
  latest: Analysis | null;
  /** Edge-triggered signals: a new direction, or an upgrade to STRONG. */
  signals: SignalEvent[];
  /** Fibonacci levels and SMC zones as of the last bar, for the chart. */
  fib: FibResult | null;
  activeZones: Zone[];
}

/** Bars needed before scores are considered meaningful. */
export const MIN_BARS = 60;

export function runEngine(candles: Candle[], overrides: Partial<EngineConfig> = {}): EngineOutput {
  const cfg: EngineConfig = {
    ...DEFAULT_ENGINE_CONFIG,
    ...overrides,
    weights: { ...DEFAULT_ENGINE_CONFIG.weights, ...overrides.weights },
  };
  const closes = candles.map((c) => c.close);
  const macdResult = macd(closes);
  const rsiValues = rsi(closes, cfg.rsiPeriod);
  const series: IndicatorSeries = {
    ema20: ema(closes, 20),
    ema50: ema(closes, 50),
    ema200: ema(closes, 200),
    nadaraya: nadarayaWatsonEnvelope(closes),
    rsi: rsiValues,
    macd: macdResult.macd,
    macdSignal: macdResult.signal,
    macdHistogram: macdResult.histogram,
    atr: atr(candles, cfg.atrPeriod),
  };
  const smc = smartMoneyConcepts(candles, { swingLength: cfg.swingLength });
  const divergences = rsiDivergences(candles, rsiValues);

  const ctx: Context = { candles, cfg, series, smc, divergences };
  const signals: SignalEvent[] = [];
  let latest: Analysis | null = null;
  let prev: SignalType = 'NEUTRAL';

  for (let i = MIN_BARS; i < candles.length; i++) {
    const analysis = analyzeBar(ctx, i);
    const sig = analysis.signal;
    const dir = signalDirection(sig);
    const isNew =
      dir !== 0 &&
      (dir !== signalDirection(prev) || (isStrongSignal(sig) && !isStrongSignal(prev)));
    if (isNew) {
      signals.push({ ...analysis, id: `${candles[i].time}-${sig.replace(' ', '_')}` });
    }
    prev = sig;
    latest = analysis;
  }

  const last = candles.length - 1;
  return {
    series,
    smc,
    divergences,
    latest,
    signals,
    fib: last >= 0 ? autoFibonacci(smc.pivots, last, cfg.fibLookback) : null,
    activeZones: last >= 0 ? activeZonesAt([...smc.orderBlocks, ...smc.fvgs], last, 300) : [],
  };
}

interface Context {
  candles: Candle[];
  cfg: EngineConfig;
  series: IndicatorSeries;
  smc: SmcResult;
  divergences: Divergence[];
}

interface SideResult {
  score: number;
  note: string;
  core?: boolean;
}

function analyzeBar(ctx: Context, i: number): Analysis {
  const { candles, cfg, series, smc } = ctx;
  const c = candles[i];
  const w = cfg.weights;
  const atrValue = series.atr[i];

  const zones = activeZonesAt([...smc.orderBlocks, ...smc.fvgs], i - 1, 300);
  const fib = autoFibonacci(smc.pivots, i, cfg.fibLookback);

  const components: ComponentScore[] = [];
  const core = {
    bull: { nadaraya: false, rsi: false, orderBlock: false },
    bear: { nadaraya: false, rsi: false, orderBlock: false },
  };
  const add = (key: keyof ScoreWeights, label: string, bull: SideResult, bear: SideResult) => {
    components.push({
      key,
      label,
      bull: round(bull.score * w[key], 1),
      bear: round(bear.score * w[key], 1),
      max: w[key],
      note: [bull.note, bear.note].filter(Boolean).join(' · '),
    });
  };

  // --- Nadaraya-Watson envelope -------------------------------------------
  {
    const nw = series.nadaraya;
    const from = Math.max(0, i - cfg.recencyBars + 1);
    let touchedLower = false;
    let touchedUpper = false;
    for (let j = from; j <= i; j++) {
      if (candles[j].low <= nw.lower[j]) touchedLower = true;
      if (candles[j].high >= nw.upper[j]) touchedUpper = true;
    }
    const half = (nw.upper[i] - nw.lower[i]) / 2;
    const pos = half > 0 ? (c.close - nw.mid[i]) / half : 0;
    const side = (touched: boolean, reclaimed: boolean, deep: boolean, label: string): SideResult =>
      touched
        ? { score: reclaimed ? 1 : 0.7, note: reclaimed ? `${label} band rejection` : `at ${label} band`, core: true }
        : deep
          ? { score: 0.35, note: `near ${label} band` }
          : { score: 0, note: '' };
    const bull = side(touchedLower, c.close > nw.lower[i], pos < -0.5, 'lower');
    const bear = side(touchedUpper, c.close < nw.upper[i], pos > 0.5, 'upper');
    core.bull.nadaraya = !!bull.core;
    core.bear.nadaraya = !!bear.core;
    add('nadaraya', 'Nadaraya-Watson', bull, bear);
  }

  // --- SMC order block / FVG retest -----------------------------------------
  {
    const retest = (dir: 'bullish' | 'bearish'): SideResult => {
      const inside = (z: Zone) =>
        z.direction === dir &&
        (dir === 'bullish' ? c.low <= z.top && c.close >= z.bottom : c.high >= z.bottom && c.close <= z.top);
      if (zones.some((z) => z.kind === 'OB' && inside(z))) {
        return { score: 1, note: `${dir} OB retest`, core: true };
      }
      if (zones.some((z) => z.kind === 'FVG' && inside(z))) {
        return { score: 0.6, note: `${dir} FVG retest` };
      }
      return { score: 0, note: '' };
    };
    const bull = retest('bullish');
    const bear = retest('bearish');
    core.bull.orderBlock = !!bull.core;
    core.bear.orderBlock = !!bear.core;
    add('smcZone', 'SMC Order Block / FVG', bull, bear);
  }

  // --- SMC market structure ------------------------------------------------
  {
    const recentChoch = (dir: 'bullish' | 'bearish') =>
      smc.structures.some(
        (s) => s.type === 'CHoCH' && s.direction === dir && s.index <= i && i - s.index < cfg.recencyBars * 2,
      );
    const t = smc.trend[i];
    const side = (dir: 'bullish' | 'bearish', want: 1 | -1): SideResult =>
      recentChoch(dir)
        ? { score: 1, note: `${dir} CHoCH` }
        : t === want
          ? { score: 0.6, note: `${dir} structure` }
          : { score: 0, note: '' };
    add('smcStructure', 'SMC Structure', side('bullish', 1), side('bearish', -1));
  }

  // --- RSI divergence --------------------------------------------------------
  {
    const recent = (dir: 'bullish' | 'bearish') =>
      ctx.divergences.some(
        (d) => d.direction === dir && d.confirmIndex <= i && i - d.confirmIndex < cfg.recencyBars + 3,
      );
    const bull: SideResult = recent('bullish') ? { score: 1, note: 'bullish divergence', core: true } : { score: 0, note: '' };
    const bear: SideResult = recent('bearish') ? { score: 1, note: 'bearish divergence', core: true } : { score: 0, note: '' };
    add('rsiDivergence', 'RSI Divergence', bull, bear);

    // --- RSI level -----------------------------------------------------------
    const from = Math.max(0, i - cfg.recencyBars + 1);
    let minRsi = Infinity;
    let maxRsi = -Infinity;
    for (let j = from; j <= i; j++) {
      if (!Number.isFinite(series.rsi[j])) continue;
      minRsi = Math.min(minRsi, series.rsi[j]);
      maxRsi = Math.max(maxRsi, series.rsi[j]);
    }
    const r = series.rsi[i];
    const oversold = minRsi < cfg.rsiOversold;
    const overbought = maxRsi > cfg.rsiOverbought;
    const levelBull: SideResult = oversold
      ? { score: 1, note: `RSI oversold (${round(minRsi, 1)})`, core: true }
      : r < 40
        ? { score: 0.5, note: 'RSI weak' }
        : { score: 0, note: '' };
    const levelBear: SideResult = overbought
      ? { score: 1, note: `RSI overbought (${round(maxRsi, 1)})`, core: true }
      : r > 60
        ? { score: 0.5, note: 'RSI strong' }
        : { score: 0, note: '' };
    add('rsiLevel', 'RSI Level', levelBull, levelBear);

    core.bull.rsi = !!bull.core || !!levelBull.core;
    core.bear.rsi = !!bear.core || !!levelBear.core;
  }

  // --- Fibonacci golden zone -------------------------------------------------
  {
    let bull: SideResult = { score: 0, note: '' };
    let bear: SideResult = { score: 0, note: '' };
    if (fib) {
      const { top, bottom } = fib.goldenZone;
      const inZone = c.low <= top && c.high >= bottom;
      const near =
        Number.isFinite(atrValue) && (Math.abs(c.close - top) < atrValue * 0.5 || Math.abs(c.close - bottom) < atrValue * 0.5);
      const result: SideResult = inZone
        ? { score: 1, note: 'in golden zone' }
        : near
          ? { score: 0.5, note: 'near golden zone' }
          : { score: 0, note: '' };
      if (fib.direction === 'up') bull = { ...result, note: result.note && `up-leg ${result.note}` };
      else bear = { ...result, note: result.note && `down-leg ${result.note}` };
    }
    add('fibonacci', 'Auto Fibonacci', bull, bear);
  }

  // --- EMA 20/50/200 trend ---------------------------------------------------
  {
    const e20 = series.ema20[i];
    const e50 = series.ema50[i];
    const e200 = series.ema200[i];
    const has200 = Number.isFinite(e200);
    const bull: SideResult =
      e20 > e50 && (has200 ? c.close > e200 : true)
        ? { score: has200 ? 1 : 0.7, note: has200 ? 'EMA20>50, above 200' : 'EMA20>50' }
        : { score: 0, note: '' };
    const bear: SideResult =
      e20 < e50 && (has200 ? c.close < e200 : true)
        ? { score: has200 ? 1 : 0.7, note: has200 ? 'EMA20<50, below 200' : 'EMA20<50' }
        : { score: 0, note: '' };
    add('ema', 'EMA 20/50/200', bull, bear);
  }

  // --- MACD momentum ---------------------------------------------------------
  {
    const h = series.macdHistogram[i];
    const hp = series.macdHistogram[i - 1];
    const bull: SideResult =
      h > 0 ? { score: h > hp ? 1 : 0.6, note: 'MACD hist > 0' } : h > hp ? { score: 0.3, note: 'MACD turning up' } : { score: 0, note: '' };
    const bear: SideResult =
      h < 0 ? { score: h < hp ? 1 : 0.6, note: 'MACD hist < 0' } : h < hp ? { score: 0.3, note: 'MACD turning down' } : { score: 0, note: '' };
    add('macd', 'MACD', bull, bear);
  }

  const totalWeight = Object.values(w).reduce((a, b) => a + b, 0) || 1;
  const bullScore = round((components.reduce((a, x) => a + x.bull, 0) / totalWeight) * 100, 1);
  const bearScore = round((components.reduce((a, x) => a + x.bear, 0) / totalWeight) * 100, 1);

  const signal = classify(cfg, bullScore, bearScore, core.bull, core.bear);
  const dir = signalDirection(signal);
  const levels =
    dir !== 0 && Number.isFinite(atrValue)
      ? computeLevels(cfg, c.close, atrValue, dir === 1 ? 'long' : 'short', zones, fib)
      : null;

  return {
    index: i,
    time: c.time,
    price: c.close,
    signal,
    bullScore,
    bearScore,
    components,
    core,
    atr: atrValue,
    rsi: series.rsi[i],
    levels,
  };
}

function coreCount(core: CoreConfluence): number {
  return Number(core.nadaraya) + Number(core.rsi) + Number(core.orderBlock);
}

export function classify(
  cfg: EngineConfig,
  bull: number,
  bear: number,
  coreBull: CoreConfluence,
  coreBear: CoreConfluence,
): SignalType {
  const pick = (score: number, other: number, core: CoreConfluence, strong: SignalType, normal: SignalType) => {
    if (score - other < cfg.minEdge) return null;
    const n = coreCount(core);
    if (score >= cfg.strongThreshold && (!cfg.requireCoreConfluence || n === 3)) return strong;
    if (score >= cfg.signalThreshold && n >= 1) return normal;
    return null;
  };
  return (
    pick(bull, bear, coreBull, 'STRONG BUY', 'BUY') ??
    pick(bear, bull, coreBear, 'STRONG SELL', 'SELL') ??
    'NEUTRAL'
  );
}

/**
 * Entry at the signal close. The stop goes beyond the nearest structural level (the
 * retested order block, else the Fibonacci swing extreme) plus a buffer, clamped to
 * a sane ATR range. Targets snap to Fibonacci levels/extensions at or beyond
 * 1R / 2R / 3R, falling back to the plain R multiple.
 */
export function computeLevels(
  cfg: EngineConfig,
  entry: number,
  atrValue: number,
  side: 'long' | 'short',
  zones: Zone[],
  fib: FibResult | null,
): TradeLevels {
  const s = side === 'long' ? 1 : -1;

  const structural: number[] = [];
  for (const z of zones) {
    if (z.kind !== 'OB') continue;
    if (side === 'long' && z.direction === 'bullish' && z.bottom < entry) structural.push(z.bottom);
    if (side === 'short' && z.direction === 'bearish' && z.top > entry) structural.push(z.top);
  }
  if (fib) {
    const extreme = side === 'long' ? fib.swingLow.price : fib.swingHigh.price;
    if ((extreme - entry) * s < 0) structural.push(extreme);
  }
  // Nearest invalidation level on the stop side.
  const anchor = structural.length
    ? structural.reduce((best, p) => (Math.abs(entry - p) < Math.abs(entry - best) ? p : best))
    : entry - s * 1.5 * atrValue;

  const rawDist = Math.abs(entry - anchor) + cfg.slBufferAtr * atrValue;
  const dist = clamp(rawDist, cfg.slMinAtr * atrValue, cfg.slMaxAtr * atrValue);
  const stopLoss = entry - s * dist;

  const candidates = (fib?.levels.map((l) => l.price) ?? [])
    .concat(fib ? [fib.swingHigh.price, fib.swingLow.price] : [])
    .filter((p) => (p - entry) * s > 0)
    .sort((a, b) => (a - b) * s);

  const targets: number[] = [];
  let floor = entry;
  for (const r of [1, 2, 3]) {
    const min = entry + s * r * dist;
    const minEdge = (x: number) => (x - min) * s >= 0 && (x - floor) * s > 0;
    const snapped = candidates.find(minEdge);
    // Do not let a far Fibonacci level stretch a target beyond the next R multiple.
    const tp = snapped !== undefined && Math.abs(snapped - min) <= dist ? snapped : min;
    targets.push(tp);
    floor = tp;
  }

  const rr = targets.map((t) => round(Math.abs(t - entry) / dist, 2)) as [number, number, number];
  return {
    side,
    entry: round(entry, 2),
    stopLoss: round(stopLoss, 2),
    tp1: round(targets[0], 2),
    tp2: round(targets[1], 2),
    tp3: round(targets[2], 2),
    rr,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function round(v: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}
