import type { Candle, Timeframe } from '../types';
import { generateDemoCandles } from './demo';
import { fetchOanda } from './oanda';
import { fetchTwelveData } from './twelvedata';

export type ProviderName = 'twelvedata' | 'oanda' | 'demo';

export interface ProviderInfo {
  name: ProviderName;
  pollMs: number;
}

const DEFAULT_POLL_MS: Record<ProviderName, number> = {
  demo: 2000,
  oanda: 5000,
  // Twelve Data's free plan allows ~800 requests/day.
  twelvedata: 60000,
};

export function resolveProvider(env: NodeJS.ProcessEnv = process.env): ProviderInfo {
  const requested = env.DATA_PROVIDER?.trim().toLowerCase();
  let name: ProviderName;
  if (requested === 'twelvedata' || requested === 'oanda' || requested === 'demo') name = requested;
  else if (env.TWELVEDATA_API_KEY) name = 'twelvedata';
  else if (env.OANDA_API_KEY) name = 'oanda';
  else name = 'demo';

  const poll = Number(env.POLL_INTERVAL_MS);
  return { name, pollMs: Number.isFinite(poll) && poll >= 1000 ? poll : DEFAULT_POLL_MS[name] };
}

export async function fetchCandles(
  tf: Timeframe,
  limit: number,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ provider: ProviderInfo; candles: Candle[] }> {
  const provider = resolveProvider(env);
  switch (provider.name) {
    case 'twelvedata': {
      if (!env.TWELVEDATA_API_KEY) throw new Error('TWELVEDATA_API_KEY is not set');
      return { provider, candles: await fetchTwelveData(env.TWELVEDATA_API_KEY, tf, limit) };
    }
    case 'oanda': {
      if (!env.OANDA_API_KEY) throw new Error('OANDA_API_KEY is not set');
      const oandaEnv = env.OANDA_ENV === 'live' ? 'live' : 'practice';
      return { provider, candles: await fetchOanda(env.OANDA_API_KEY, oandaEnv, tf, limit) };
    }
    default:
      return { provider, candles: generateDemoCandles(tf, limit) };
  }
}
