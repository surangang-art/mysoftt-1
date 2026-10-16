'use client';

import { useEffect } from 'react';
import type { Toast } from '@/hooks/useSignalAlerts';
import SignalBadge from './SignalBadge';

const TTL_MS = 12000;

export default function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), TTL_MS);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const { signal, timeframe } = toast;
  const buy = signal.signal.includes('BUY');
  const l = signal.levels;
  return (
    <div
      role="alert"
      className={`toast-in pointer-events-auto rounded-lg border bg-panel p-3 shadow-2xl ${
        buy ? 'border-bull/60' : 'border-bear/60'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SignalBadge signal={signal.signal} />
          <span className="font-mono text-xs text-muted">XAU/USD · {timeframe}</span>
        </div>
        <button onClick={() => onDismiss(toast.id)} className="text-muted hover:text-white" aria-label="Dismiss">
          ×
        </button>
      </div>
      {l && (
        <div className="mt-2 grid grid-cols-3 gap-1 font-mono text-[11px]">
          <span className="text-muted">
            Entry <span className="text-white">{l.entry.toFixed(2)}</span>
          </span>
          <span className="text-muted">
            SL <span className="text-bear">{l.stopLoss.toFixed(2)}</span>
          </span>
          <span className="text-muted">
            TP1 <span className="text-bull">{l.tp1.toFixed(2)}</span>
          </span>
        </div>
      )}
    </div>
  );
}
