import { TIMEFRAME_SECONDS, type Candle, type Timeframe } from '../types';

/**
 * Deterministic synthetic XAU/USD feed for running the app without an API key.
 * Each bar is a pure function of its timestamp, so polls extend the same history
 * instead of regenerating it; the forming bar wiggles every couple of seconds.
 * The prices are NOT real market data.
 */
export function generateDemoCandles(tf: Timeframe, limit: number, nowMs = Date.now()): Candle[] {
  const step = TIMEFRAME_SECONDS[tf];
  const nowSec = Math.floor(nowMs / 1000);
  const current = Math.floor(nowSec / step);
  const scale = Math.sqrt(step / 60);
  const out: Candle[] = [];

  for (let k = current - limit + 1; k <= current; k++) {
    const open = priceAt(k - 1, scale, step);
    let close = priceAt(k, scale, step);
    if (k === current) {
      // Interpolate toward the bar's close as the bar progresses, plus live jitter.
      const progress = (nowSec - k * step) / step;
      close = open + (close - open) * progress + (hash(Math.floor(nowMs / 2000)) - 0.5) * 0.3 * scale;
    }
    const wick = 0.35 * scale;
    out.push({
      time: k * step,
      open: round(open),
      close: round(close),
      high: round(Math.max(open, close) + hash(k * 3 + 1) * wick),
      low: round(Math.min(open, close) - hash(k * 7 + 2) * wick),
    });
  }
  return out;
}

function priceAt(k: number, scale: number, step: number): number {
  // Absolute time in minutes keeps waves consistent across timeframes.
  const t = (k * step) / 60;
  const waves =
    40 * Math.sin(t / 9000) + 18 * Math.sin(t / 2100 + 1) + 7 * Math.sin(t / 380 + 2) + 3 * Math.sin(t / 70 + 3);
  // Smoothed hash noise sampled per bar of this timeframe.
  const noise = (smoothNoise(k / 6) - 0.5) * 6 * scale + (hash(k) - 0.5) * 0.8 * scale;
  return 2650 + waves + noise;
}

function smoothNoise(x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash(i) * (1 - u) + hash(i + 1) * u;
}

/** Stable pseudo-random number in [0, 1) for an integer. */
function hash(n: number): number {
  let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}
