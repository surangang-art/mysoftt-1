import type { SignalEvent } from '@/lib/signals/engine';
import SignalBadge from './SignalBadge';

export default function SignalLog({ signals }: { signals: SignalEvent[] }) {
  const rows = [...signals].reverse().slice(0, 50);
  return (
    <section className="panel flex min-h-0 flex-col">
      <h2 className="panel-title border-b border-line px-4 py-2.5">Signal log</h2>
      {rows.length === 0 ? (
        <p className="p-4 text-xs text-muted">No signals in the loaded history.</p>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full font-mono text-xs">
            <thead className="sticky top-0 bg-panel text-left text-[10px] uppercase tracking-wider text-muted">
              <tr>
                <th className="px-3 py-1.5 font-medium">Time</th>
                <th className="px-2 py-1.5 font-medium">Signal</th>
                <th className="px-2 py-1.5 text-right font-medium">Entry</th>
                <th className="px-2 py-1.5 text-right font-medium">SL</th>
                <th className="px-2 py-1.5 text-right font-medium">TP1</th>
                <th className="px-3 py-1.5 text-right font-medium">Score</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-t border-line/60 hover:bg-panel2">
                  <td className="whitespace-nowrap px-3 py-1.5 text-muted">
                    {new Date(s.time * 1000).toLocaleString([], {
                      month: 'short',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-2 py-1.5">
                    <SignalBadge signal={s.signal} />
                  </td>
                  <td className="px-2 py-1.5 text-right text-white">{s.levels?.entry.toFixed(2)}</td>
                  <td className="px-2 py-1.5 text-right text-bear">{s.levels?.stopLoss.toFixed(2)}</td>
                  <td className="px-2 py-1.5 text-right text-bull">{s.levels?.tp1.toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right text-muted">
                    {s.signal.includes('BUY') ? s.bullScore : s.bearScore}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
