'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import Header from '@/components/Header';
import SettingsPanel from '@/components/SettingsPanel';
import SignalLog from '@/components/SignalLog';
import SignalPanel from '@/components/SignalPanel';
import TimeframeSwitcher from '@/components/TimeframeSwitcher';
import ToastStack from '@/components/ToastStack';
import { useMarketData } from '@/hooks/useMarketData';
import { useSettings } from '@/hooks/useSettings';
import { useSignalAlerts } from '@/hooks/useSignalAlerts';
import { runEngine } from '@/lib/signals/engine';
import { TIMEFRAME_SECONDS } from '@/lib/types';

// Charts touch the DOM/canvas, so render them on the client only.
const PriceChart = dynamic(() => import('@/components/PriceChart'), { ssr: false });
const TradingViewWidget = dynamic(() => import('@/components/TradingViewWidget'), { ssr: false });

const PLAN_MAX_AGE_BARS = 30;

export default function Home() {
  const [settings, updateSettings] = useSettings();
  const [view, setView] = useState<'signals' | 'tradingview'>('signals');
  const tf = settings.timeframe;
  const { candles, provider, status, error, updatedAt } = useMarketData(tf);

  const output = useMemo(() => (candles.length ? runEngine(candles) : null), [candles]);

  // Signals and the trade plan only count once their bar has closed.
  const closedSignals = useMemo(() => {
    const now = (updatedAt ?? Date.now()) / 1000;
    return (output?.signals ?? []).filter((s) => s.time + TIMEFRAME_SECONDS[tf] <= now);
  }, [output, tf, updatedAt]);
  const lastSignal = closedSignals.at(-1) ?? null;
  // Only draw the trade plan on the chart while the signal is still recent.
  const planLevels =
    lastSignal && candles.length - 1 - lastSignal.index <= PLAN_MAX_AGE_BARS ? lastSignal.levels : null;

  const { toasts, dismiss, telegramError } = useSignalAlerts(
    closedSignals,
    tf,
    status === 'live' && candles.length > 0,
    settings,
  );

  return (
    <div className="flex min-h-screen flex-col">
      <Header candles={candles} provider={provider} status={status} error={error} updatedAt={updatedAt} />

      <main className="grid flex-1 gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-3">
          <section className="panel flex h-[68vh] min-h-[460px] flex-col overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
              <TimeframeSwitcher value={tf} onChange={(timeframe) => updateSettings({ timeframe })} />
              <div className="flex rounded-md border border-line bg-panel2 p-0.5 text-xs">
                {(['signals', 'tradingview'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={`rounded px-2.5 py-1 ${view === v ? 'bg-line text-white' : 'text-muted hover:text-white'}`}
                  >
                    {v === 'signals' ? 'Signal chart' : 'TradingView'}
                  </button>
                ))}
              </div>
            </div>
            {error && status === 'error' && (
              <div className="border-b border-bear/40 bg-bear/10 px-3 py-1.5 text-xs text-bear">{error}</div>
            )}
            <div className="min-h-0 flex-1">
              {view === 'signals' ? (
                <PriceChart
                  candles={candles}
                  output={output}
                  timeframe={tf}
                  settings={settings}
                  levels={planLevels}
                />
              ) : (
                <TradingViewWidget timeframe={tf} />
              )}
            </div>
          </section>

          <div className="h-[320px]">
            <SignalLog signals={closedSignals} />
          </div>
        </div>

        <aside className="flex flex-col gap-3">
          <SignalPanel analysis={output?.latest ?? null} lastSignal={lastSignal} />
          <SettingsPanel settings={settings} onChange={updateSettings} telegramError={telegramError} />
          <p className="px-1 text-[10px] leading-relaxed text-muted/70">
            Signals are generated algorithmically from technical indicators and are not financial advice. No
            indicator combination is consistently accurate; backtest and paper-trade before risking capital.
          </p>
        </aside>
      </main>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
