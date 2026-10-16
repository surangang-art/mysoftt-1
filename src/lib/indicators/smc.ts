import type { Candle, Direction } from '../types';
import { findPivots, type Pivot } from './pivots';

export interface StructureBreak {
  index: number;
  time: number;
  /** The swing level that was broken. */
  price: number;
  pivotIndex: number;
  type: 'BOS' | 'CHoCH';
  direction: Direction;
}

export interface Zone {
  id: string;
  kind: 'OB' | 'FVG';
  direction: Direction;
  top: number;
  bottom: number;
  /** Bar where the zone begins on the chart. */
  startIndex: number;
  startTime: number;
  /** Bar at which the zone became known. */
  createdIndex: number;
  /** Bar at which price invalidated (OB) or filled (FVG) the zone. */
  mitigatedIndex?: number;
}

export interface SmcConfig {
  swingLength: number;
  /** Minimum FVG size in price units. */
  fvgMinSize: number;
}

export interface SmcResult {
  pivots: Pivot[];
  structures: StructureBreak[];
  orderBlocks: Zone[];
  fvgs: Zone[];
  /** Market structure trend per bar: 1 bullish, -1 bearish, 0 undefined. */
  trend: Array<1 | -1 | 0>;
}

export const DEFAULT_SMC: SmcConfig = { swingLength: 5, fvgMinSize: 0 };

interface SwingState {
  price: number;
  index: number;
  broken: boolean;
}

/**
 * Smart Money Concepts: swing market structure (BOS / CHoCH), order blocks and
 * fair value gaps, following the logic of the LuxAlgo SMC indicator:
 *
 * - A close beyond the last unbroken swing high/low is a structure break. It is a
 *   CHoCH when it flips the prevailing trend, otherwise a BOS.
 * - On a bullish break, the order block is the candle with the lowest low between
 *   the broken swing and the break (bearish break: highest high).
 * - A bullish FVG is a 3-candle pattern where candle[i].low > candle[i-2].high.
 * - Order blocks are mitigated when a close goes through them; FVGs are filled
 *   when price trades back to their far edge.
 */
export function smartMoneyConcepts(candles: Candle[], config: Partial<SmcConfig> = {}): SmcResult {
  const { swingLength, fvgMinSize } = { ...DEFAULT_SMC, ...config };
  const n = candles.length;
  const pivots = findPivots(candles, swingLength);

  const pivotsByConfirm = new Map<number, Pivot[]>();
  for (const p of pivots) {
    const list = pivotsByConfirm.get(p.confirmIndex) ?? [];
    list.push(p);
    pivotsByConfirm.set(p.confirmIndex, list);
  }

  const structures: StructureBreak[] = [];
  const orderBlocks: Zone[] = [];
  const fvgs: Zone[] = [];
  const active: Zone[] = [];
  const trend = new Array<1 | -1 | 0>(n).fill(0);

  let swingHigh: SwingState | null = null;
  let swingLow: SwingState | null = null;
  let state: 1 | -1 | 0 = 0;

  for (let i = 0; i < n; i++) {
    const c = candles[i];

    for (const p of pivotsByConfirm.get(i) ?? []) {
      if (p.type === 'high') swingHigh = { price: p.price, index: p.index, broken: false };
      else swingLow = { price: p.price, index: p.index, broken: false };
    }

    // Mitigate zones created on earlier bars.
    for (let z = active.length - 1; z >= 0; z--) {
      const zone = active[z];
      const hit =
        zone.kind === 'OB'
          ? zone.direction === 'bullish'
            ? c.close < zone.bottom
            : c.close > zone.top
          : zone.direction === 'bullish'
            ? c.low <= zone.bottom
            : c.high >= zone.top;
      if (hit) {
        zone.mitigatedIndex = i;
        active.splice(z, 1);
      }
    }

    if (swingHigh && !swingHigh.broken && c.close > swingHigh.price) {
      structures.push({
        index: i,
        time: c.time,
        price: swingHigh.price,
        pivotIndex: swingHigh.index,
        type: state === -1 ? 'CHoCH' : 'BOS',
        direction: 'bullish',
      });
      swingHigh.broken = true;
      state = 1;
      const k = extremeIndex(candles, swingHigh.index, i, 'low');
      const ob = makeZone('OB', 'bullish', candles[k].high, candles[k].low, k, i, candles);
      orderBlocks.push(ob);
      active.push(ob);
    }

    if (swingLow && !swingLow.broken && c.close < swingLow.price) {
      structures.push({
        index: i,
        time: c.time,
        price: swingLow.price,
        pivotIndex: swingLow.index,
        type: state === 1 ? 'CHoCH' : 'BOS',
        direction: 'bearish',
      });
      swingLow.broken = true;
      state = -1;
      const k = extremeIndex(candles, swingLow.index, i, 'high');
      const ob = makeZone('OB', 'bearish', candles[k].high, candles[k].low, k, i, candles);
      orderBlocks.push(ob);
      active.push(ob);
    }

    if (i >= 2) {
      const a = candles[i - 2];
      const mid = candles[i - 1];
      if (c.low > a.high && mid.close > a.high && c.low - a.high > fvgMinSize) {
        const fvg = makeZone('FVG', 'bullish', c.low, a.high, i - 2, i, candles);
        fvgs.push(fvg);
        active.push(fvg);
      } else if (c.high < a.low && mid.close < a.low && a.low - c.high > fvgMinSize) {
        const fvg = makeZone('FVG', 'bearish', a.low, c.high, i - 2, i, candles);
        fvgs.push(fvg);
        active.push(fvg);
      }
    }

    trend[i] = state;
  }

  return { pivots, structures, orderBlocks, fvgs, trend };
}

/** Zones that exist (created and not yet mitigated) as of bar `index`. */
export function activeZonesAt(zones: Zone[], index: number, maxAge = Infinity): Zone[] {
  return zones.filter(
    (z) =>
      z.createdIndex <= index &&
      index - z.createdIndex <= maxAge &&
      (z.mitigatedIndex === undefined || z.mitigatedIndex > index),
  );
}

function extremeIndex(candles: Candle[], from: number, to: number, kind: 'low' | 'high'): number {
  let best = Math.max(0, to - 1);
  for (let k = from; k < to; k++) {
    if (kind === 'low' ? candles[k].low < candles[best].low : candles[k].high > candles[best].high) {
      best = k;
    }
  }
  return best;
}

function makeZone(
  kind: Zone['kind'],
  direction: Direction,
  top: number,
  bottom: number,
  startIndex: number,
  createdIndex: number,
  candles: Candle[],
): Zone {
  return {
    id: `${kind}-${direction}-${candles[startIndex].time}-${createdIndex}`,
    kind,
    direction,
    top,
    bottom,
    startIndex,
    startTime: candles[startIndex].time,
    createdIndex,
  };
}
