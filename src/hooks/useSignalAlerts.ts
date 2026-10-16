'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { playAlert } from '@/lib/alerts/sound';
import { formatSignalMessage } from '@/lib/alerts/telegram';
import type { SignalEvent } from '@/lib/signals/engine';
import { TIMEFRAME_SECONDS, isStrongSignal, signalDirection, type Timeframe } from '@/lib/types';
import type { Settings } from './useSettings';

export interface Toast {
  id: string;
  signal: SignalEvent;
  timeframe: Timeframe;
}

/**
 * Raises toast / sound / Telegram alerts for signals on newly closed bars. Signals
 * present when a timeframe first loads are history and never alert.
 */
export function useSignalAlerts(signals: SignalEvent[], tf: Timeframe, ready: boolean, settings: Settings) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [telegramError, setTelegramError] = useState<string | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const primed = useRef<Timeframe | null>(null);

  useEffect(() => {
    if (!ready) {
      primed.current = null;
      return;
    }
    const nowSec = Date.now() / 1000;
    const closed = signals.filter((s) => s.time + TIMEFRAME_SECONDS[tf] <= nowSec);

    if (primed.current !== tf) {
      primed.current = tf;
      closed.forEach((s) => seen.current.add(`${tf}:${s.id}`));
      return;
    }

    for (const s of closed) {
      const key = `${tf}:${s.id}`;
      if (seen.current.has(key)) continue;
      seen.current.add(key);
      if (settings.alertLevel === 'STRONG' && !isStrongSignal(s.signal)) continue;

      setToasts((prev) => [{ id: key, signal: s, timeframe: tf }, ...prev].slice(0, 5));
      const dir = signalDirection(s.signal);
      if (settings.soundEnabled && dir !== 0) playAlert(dir);
      if (settings.telegramEnabled) {
        fetch('/api/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: formatSignalMessage(s, tf) }),
        })
          .then(async (res) => {
            if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? `HTTP ${res.status}`);
            setTelegramError(null);
          })
          .catch((err: unknown) => setTelegramError(err instanceof Error ? err.message : String(err)));
      }
    }
  }, [signals, tf, ready, settings.alertLevel, settings.soundEnabled, settings.telegramEnabled]);

  const dismiss = useCallback((id: string) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);

  return { toasts, dismiss, telegramError };
}
