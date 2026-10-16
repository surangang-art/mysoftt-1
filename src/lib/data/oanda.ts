import type { Candle, Timeframe } from '../types';

const GRANULARITY: Record<Timeframe, string> = {
  '1m': 'M1',
  '5m': 'M5',
  '15m': 'M15',
  '1h': 'H1',
  '4h': 'H4',
  '1D': 'D',
};

interface OandaResponse {
  errorMessage?: string;
  candles?: Array<{ time: string; volume: number; mid: { o: string; h: string; l: string; c: string } }>;
}

export async function fetchOanda(
  apiKey: string,
  env: 'practice' | 'live',
  tf: Timeframe,
  limit: number,
): Promise<Candle[]> {
  const host = env === 'live' ? 'https://api-fxtrade.oanda.com' : 'https://api-fxpractice.oanda.com';
  const url = new URL(`${host}/v3/instruments/XAU_USD/candles`);
  url.searchParams.set('granularity', GRANULARITY[tf]);
  url.searchParams.set('count', String(Math.min(limit, 5000)));
  url.searchParams.set('price', 'M');
  // Daily candles aligned to UTC midnight rather than New York 17:00.
  if (tf === '1D') {
    url.searchParams.set('dailyAlignment', '0');
    url.searchParams.set('alignmentTimezone', 'UTC');
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, 'Accept-Datetime-Format': 'UNIX' },
    cache: 'no-store',
  });
  const body = (await res.json()) as OandaResponse;
  if (!res.ok || !body.candles) {
    throw new Error(`OANDA: ${body.errorMessage ?? res.statusText}`);
  }
  return body.candles.map((c) => ({
    time: Math.floor(Number(c.time)),
    open: Number(c.mid.o),
    high: Number(c.mid.h),
    low: Number(c.mid.l),
    close: Number(c.mid.c),
    volume: c.volume,
  }));
}
