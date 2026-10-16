import type { Candle, Timeframe } from '../types';

const INTERVALS: Record<Timeframe, string> = {
  '1m': '1min',
  '5m': '5min',
  '15m': '15min',
  '1h': '1h',
  '4h': '4h',
  '1D': '1day',
};

interface TwelveDataResponse {
  status?: string;
  message?: string;
  values?: Array<{ datetime: string; open: string; high: string; low: string; close: string; volume?: string }>;
}

export async function fetchTwelveData(apiKey: string, tf: Timeframe, limit: number): Promise<Candle[]> {
  const url = new URL('https://api.twelvedata.com/time_series');
  url.searchParams.set('symbol', 'XAU/USD');
  url.searchParams.set('interval', INTERVALS[tf]);
  url.searchParams.set('outputsize', String(limit));
  url.searchParams.set('timezone', 'UTC');
  url.searchParams.set('order', 'ASC');
  url.searchParams.set('apikey', apiKey);

  const res = await fetch(url, { cache: 'no-store' });
  const body = (await res.json()) as TwelveDataResponse;
  if (!res.ok || body.status === 'error' || !body.values) {
    throw new Error(`Twelve Data: ${body.message ?? res.statusText}`);
  }
  return body.values
    .map((v) => ({
      time: parseUtc(v.datetime),
      open: Number(v.open),
      high: Number(v.high),
      low: Number(v.low),
      close: Number(v.close),
      volume: v.volume ? Number(v.volume) : undefined,
    }))
    .sort((a, b) => a.time - b.time);
}

/** "2024-05-01 13:45:00" or "2024-05-01" in UTC -> unix seconds. */
function parseUtc(datetime: string): number {
  const iso = datetime.length === 10 ? `${datetime}T00:00:00Z` : `${datetime.replace(' ', 'T')}Z`;
  return Math.floor(Date.parse(iso) / 1000);
}
