'use client';

import { useEffect, useRef } from 'react';
import type { Timeframe } from '@/lib/types';

const INTERVAL: Record<Timeframe, string> = { '1m': '1', '5m': '5', '15m': '15', '1h': '60', '4h': '240', '1D': 'D' };

declare global {
  interface Window {
    TradingView?: { widget: new (options: Record<string, unknown>) => unknown };
  }
}

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  scriptPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://s3.tradingview.com/tv.js';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error('Failed to load TradingView'));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/** Official TradingView Advanced Chart widget for OANDA:XAUUSD (reference view). */
export default function TradingViewWidget({ timeframe }: { timeframe: Timeframe }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const id = `tv-${Math.random().toString(36).slice(2)}`;
    if (host.current) host.current.innerHTML = `<div id="${id}" style="height:100%;width:100%"></div>`;
    loadScript()
      .then(() => {
        if (cancelled || !window.TradingView) return;
        new window.TradingView.widget({
          container_id: id,
          symbol: 'OANDA:XAUUSD',
          interval: INTERVAL[timeframe],
          timezone: 'Etc/UTC',
          theme: 'dark',
          style: '1',
          locale: 'en',
          autosize: true,
          hide_side_toolbar: false,
          allow_symbol_change: false,
          studies: ['RSI@tv-basicstudies', 'MACD@tv-basicstudies'],
        });
      })
      .catch(() => {
        if (host.current) host.current.textContent = 'TradingView widget could not be loaded.';
      });
    return () => {
      cancelled = true;
    };
  }, [timeframe]);

  return <div ref={host} className="h-full w-full text-sm text-muted" />;
}
