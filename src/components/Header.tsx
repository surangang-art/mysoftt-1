import type { FeedStatus } from '@/hooks/useMarketData';
import type { Candle } from '@/lib/types';

interface Props {
  candles: Candle[];
  provider: string;
  status: FeedStatus;
  error: string | null;
  updatedAt: number | null;
}

const PROVIDER_LABEL: Record<string, string> = { twelvedata: 'Twelve Data', oanda: 'OANDA', demo: 'DEMO DATA' };

export default function Header({ candles, provider, status, error, updatedAt }: Props) {
  const last = candles.at(-1);
  // Change versus the open of the first bar of the current UTC day.
  const dayStart = last ? Math.floor(last.time / 86400) * 86400 : 0;
  const dayOpen = candles.find((c) => c.time >= dayStart)?.open ?? last?.open;
  const change = last && dayOpen ? last.close - dayOpen : 0;
  const pct = dayOpen ? (change / dayOpen) * 100 : 0;
  const up = change >= 0;

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-panel px-4 py-3">
      <div className="flex items-center gap-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gold/15 font-bold text-gold">Au</div>
        <div>
          <div className="text-sm font-semibold tracking-wide text-white">XAU/USD</div>
          <div className="text-[11px] text-muted">Gold Spot · Signal Terminal</div>
        </div>
        <div className="ml-2 font-mono">
          <span className="text-2xl font-semibold text-white">{last ? last.close.toFixed(2) : '—'}</span>
          {last && (
            <span className={`ml-2 text-sm ${up ? 'text-bull' : 'text-bear'}`}>
              {up ? '+' : ''}
              {change.toFixed(2)} ({up ? '+' : ''}
              {pct.toFixed(2)}%)
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs">
        {provider && (
          <span
            className={`rounded px-2 py-0.5 font-medium ${
              provider === 'demo' ? 'bg-gold/15 text-gold' : 'bg-panel2 text-muted'
            }`}
            title={provider === 'demo' ? 'Synthetic prices. Set TWELVEDATA_API_KEY or OANDA_API_KEY for real data.' : undefined}
          >
            {PROVIDER_LABEL[provider] ?? provider}
          </span>
        )}
        <span className="flex items-center gap-1.5 text-muted" title={error ?? undefined}>
          <span
            className={`h-2 w-2 rounded-full ${
              status === 'live' ? 'animate-pulse bg-bull' : status === 'loading' ? 'bg-gold' : 'bg-bear'
            }`}
          />
          {status === 'live' ? 'Live' : status === 'loading' ? 'Connecting' : 'Feed error'}
          {updatedAt && status === 'live' && (
            <span className="hidden sm:inline">· {new Date(updatedAt).toLocaleTimeString()}</span>
          )}
        </span>
      </div>
    </header>
  );
}
