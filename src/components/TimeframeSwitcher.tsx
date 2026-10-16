import { TIMEFRAMES, type Timeframe } from '@/lib/types';

interface Props {
  value: Timeframe;
  onChange: (tf: Timeframe) => void;
}

export default function TimeframeSwitcher({ value, onChange }: Props) {
  return (
    <div className="flex rounded-md border border-line bg-panel2 p-0.5" role="tablist" aria-label="Timeframe">
      {TIMEFRAMES.map((tf) => (
        <button
          key={tf}
          role="tab"
          aria-selected={tf === value}
          onClick={() => onChange(tf)}
          className={`rounded px-2.5 py-1 font-mono text-xs transition-colors ${
            tf === value ? 'bg-gold text-black' : 'text-muted hover:text-white'
          }`}
        >
          {tf}
        </button>
      ))}
    </div>
  );
}
