import { NextResponse, type NextRequest } from 'next/server';
import { fetchCandles } from '@/lib/data/provider';
import { isTimeframe, type Candle } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Short-lived per-instance cache so several open tabs share one upstream request.
const CACHE_MS = 1500;
const cache = new Map<string, { at: number; body: unknown }>();

export async function GET(req: NextRequest) {
  const tf = req.nextUrl.searchParams.get('tf') ?? '15m';
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get('limit')) || 500, 1), 1000);
  if (!isTimeframe(tf)) {
    return NextResponse.json({ error: `Unsupported timeframe: ${tf}` }, { status: 400 });
  }

  const key = `${tf}:${limit}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return NextResponse.json(hit.body);

  try {
    const { provider, candles } = await fetchCandles(tf, limit);
    const body: { provider: string; pollMs: number; candles: Candle[] } = {
      provider: provider.name,
      pollMs: provider.pollMs,
      candles,
    };
    cache.set(key, { at: Date.now(), body });
    return NextResponse.json(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load candles';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
