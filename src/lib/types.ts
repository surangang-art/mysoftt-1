export const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1D'] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

export const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '4h': 14400,
  '1D': 86400,
};

export function isTimeframe(value: unknown): value is Timeframe {
  return typeof value === 'string' && (TIMEFRAMES as readonly string[]).includes(value);
}

/** OHLC bar. `time` is the bar open time in UTC seconds. */
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export type Direction = 'bullish' | 'bearish';

export type SignalType = 'STRONG BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG SELL';

export function signalDirection(signal: SignalType): 1 | -1 | 0 {
  if (signal === 'STRONG BUY' || signal === 'BUY') return 1;
  if (signal === 'STRONG SELL' || signal === 'SELL') return -1;
  return 0;
}

export function isStrongSignal(signal: SignalType): boolean {
  return signal === 'STRONG BUY' || signal === 'STRONG SELL';
}
