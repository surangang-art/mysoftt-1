'use client';

import { useEffect, useRef, useState } from 'react';
import { mergeCandles } from '@/lib/data/merge';
import type { Candle, Timeframe } from '@/lib/types';

export type FeedStatus = 'loading' | 'live' | 'error';

interface CandlesResponse {
  provider?: string;
  pollMs?: number;
  candles?: Candle[];
  error?: string;
}

const HISTORY = 500;
const UPDATE = 3;

/** Loads XAU/USD history for `tf`, then polls for the latest bars and merges them in. */
export function useMarketData(tf: Timeframe) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [provider, setProvider] = useState<string>('');
  const [status, setStatus] = useState<FeedStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const pollRef = useRef(15000);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setCandles([]);
    setStatus('loading');
    setError(null);

    const load = async (limit: number) => {
      const res = await fetch(`/api/candles?tf=${tf}&limit=${limit}`, { cache: 'no-store' });
      const body = (await res.json()) as CandlesResponse;
      if (!res.ok || !body.candles) throw new Error(body.error ?? `HTTP ${res.status}`);
      if (body.pollMs) pollRef.current = body.pollMs;
      if (body.provider) setProvider(body.provider);
      return body.candles;
    };

    const schedule = () => {
      timer = setTimeout(poll, document.hidden ? Math.max(pollRef.current, 30000) : pollRef.current);
    };

    const poll = async () => {
      try {
        const latest = await load(UPDATE);
        if (cancelled) return;
        setCandles((prev) => mergeCandles(prev, latest, HISTORY + 200));
        setStatus('live');
        setError(null);
        setUpdatedAt(Date.now());
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setError(err instanceof Error ? err.message : String(err));
      }
      if (!cancelled) schedule();
    };

    (async () => {
      try {
        const history = await load(HISTORY);
        if (cancelled) return;
        setCandles(history);
        setStatus('live');
        setUpdatedAt(Date.now());
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setError(err instanceof Error ? err.message : String(err));
      }
      if (!cancelled) schedule();
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [tf]);

  return { candles, provider, status, error, updatedAt };
}
