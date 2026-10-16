import type { Analysis, CoreConfluence, TradeLevels } from '@/lib/signals/engine';
import SignalBadge from './SignalBadge';

interface Props {
  analysis: Analysis | null;
  /** Latest signal on a closed bar, with its trade plan. */
  lastSignal: Analysis | null;
}

export default function SignalPanel({ analysis, lastSignal }: Props) {
  if (!analysis) {
    return <section className="panel p-4 text-sm text-muted">Waiting for enough data…</section>;
  }
  return (
    <section className="panel space-y-4 p-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="panel-title">Live confluence</h2>
          <p className="text-[11px] text-muted">Current bar (still forming)</p>
        </div>
        <SignalBadge signal={analysis.signal} large />
      </div>

      <ScoreBar bull={analysis.bullScore} bear={analysis.bearScore} />

      <div className="grid grid-cols-2 gap-3">
        <CoreChecklist title="Buy core" core={analysis.core.bull} tone="bull" />
        <CoreChecklist title="Sell core" core={analysis.core.bear} tone="bear" />
      </div>

      <div className="space-y-1.5">
        {analysis.components.map((c) => (
          <div key={c.key} className="text-xs">
            <div className="flex justify-between text-muted">
              <span>{c.label}</span>
              <span className="font-mono">
                <span className="text-bull">{c.bull}</span> / <span className="text-bear">{c.bear}</span>
                <span className="text-muted"> of {c.max}</span>
              </span>
            </div>
            <div className="mt-0.5 flex h-1.5 gap-0.5">
              <div className="flex flex-1 justify-end rounded-l bg-panel2">
                <div className="rounded-l bg-bull" style={{ width: `${(c.bull / c.max) * 100}%` }} />
              </div>
              <div className="flex-1 rounded-r bg-panel2">
                <div className="h-full rounded-r bg-bear" style={{ width: `${(c.bear / c.max) * 100}%` }} />
              </div>
            </div>
            {c.note && <div className="mt-0.5 text-[10px] text-muted/80">{c.note}</div>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 font-mono text-xs">
        <Stat label="RSI" value={Number.isFinite(analysis.rsi) ? analysis.rsi.toFixed(1) : '—'} />
        <Stat label="ATR" value={Number.isFinite(analysis.atr) ? analysis.atr.toFixed(2) : '—'} />
      </div>

      {lastSignal?.levels && <TradePlan signal={lastSignal} levels={lastSignal.levels} />}
    </section>
  );
}

function ScoreBar({ bull, bear }: { bull: number; bear: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between font-mono text-xs">
        <span className="text-bull">Bull {bull}</span>
        <span className="text-bear">Bear {bear}</span>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded bg-panel2">
        <div className="bg-bull" style={{ width: `${bull / 2}%` }} />
        <div className="flex-1" />
        <div className="bg-bear" style={{ width: `${bear / 2}%` }} />
      </div>
    </div>
  );
}

function CoreChecklist({ title, core, tone }: { title: string; core: CoreConfluence; tone: 'bull' | 'bear' }) {
  const items: Array<[string, boolean]> = [
    ['Nadaraya band', core.nadaraya],
    ['RSI div / extreme', core.rsi],
    ['SMC order block', core.orderBlock],
  ];
  return (
    <div className="rounded-md bg-panel2 p-2">
      <div className="mb-1 text-[10px] uppercase tracking-wider text-muted">{title}</div>
      {items.map(([label, ok]) => (
        <div key={label} className={`text-xs ${ok ? (tone === 'bull' ? 'text-bull' : 'text-bear') : 'text-muted/60'}`}>
          {ok ? '●' : '○'} {label}
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-panel2 px-2 py-1.5">
      <span className="text-muted">{label} </span>
      <span className="text-white">{value}</span>
    </div>
  );
}

function TradePlan({ signal, levels }: { signal: Analysis; levels: TradeLevels }) {
  const rows: Array<[string, number, string]> = [
    ['Entry', levels.entry, 'text-sky-400'],
    ['Stop Loss', levels.stopLoss, 'text-bear'],
    [`TP1 · ${levels.rr[0]}R`, levels.tp1, 'text-bull'],
    [`TP2 · ${levels.rr[1]}R`, levels.tp2, 'text-bull'],
    [`TP3 · ${levels.rr[2]}R`, levels.tp3, 'text-bull'],
  ];
  return (
    <div className="rounded-md border border-line p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="panel-title">Last signal plan</h3>
        <SignalBadge signal={signal.signal} />
      </div>
      <div className="mb-2 text-[10px] text-muted">
        {new Date(signal.time * 1000).toLocaleString()} · {levels.side.toUpperCase()}
      </div>
      <dl className="space-y-1 font-mono text-sm">
        {rows.map(([label, price, color]) => (
          <div key={label} className="flex justify-between">
            <dt className="text-muted">{label}</dt>
            <dd className={color}>{price.toFixed(2)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
