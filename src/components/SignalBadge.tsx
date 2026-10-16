import type { SignalType } from '@/lib/types';

const STYLES: Record<SignalType, string> = {
  'STRONG BUY': 'bg-bull text-black',
  BUY: 'bg-bull/20 text-bull',
  NEUTRAL: 'bg-panel2 text-muted',
  SELL: 'bg-bear/20 text-bear',
  'STRONG SELL': 'bg-bear text-black',
};

export default function SignalBadge({ signal, large = false }: { signal: SignalType; large?: boolean }) {
  return (
    <span
      className={`inline-block rounded font-bold tracking-wide ${STYLES[signal]} ${
        large ? 'px-3 py-1.5 text-lg' : 'px-1.5 py-0.5 text-[10px]'
      }`}
    >
      {signal}
    </span>
  );
}
