'use client';

import { useEffect, useState } from 'react';
import { unlockAudio, playAlert } from '@/lib/alerts/sound';
import type { Settings } from '@/hooks/useSettings';

interface Props {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  telegramError: string | null;
}

export default function SettingsPanel({ settings, onChange, telegramError }: Props) {
  const [telegramConfigured, setTelegramConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/telegram')
      .then((r) => r.json() as Promise<{ configured: boolean }>)
      .then((b) => setTelegramConfigured(b.configured))
      .catch(() => setTelegramConfigured(false));
  }, []);

  const toggle = (key: keyof Settings) => () => onChange({ [key]: !settings[key] } as Partial<Settings>);

  return (
    <section className="panel space-y-3 p-4 text-xs">
      <h2 className="panel-title">Alerts</h2>
      <Toggle
        label="Sound alerts"
        checked={settings.soundEnabled}
        onChange={() => {
          // Enabling from a click unlocks browser audio.
          unlockAudio();
          if (!settings.soundEnabled) playAlert(1);
          onChange({ soundEnabled: !settings.soundEnabled });
        }}
      />
      <Toggle
        label="Telegram alerts"
        checked={settings.telegramEnabled}
        disabled={telegramConfigured === false}
        onChange={toggle('telegramEnabled')}
        hint={
          telegramConfigured === false
            ? 'Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID on the server'
            : (telegramError ?? undefined)
        }
      />
      <label className="flex items-center justify-between">
        <span className="text-muted">Alert on</span>
        <select
          value={settings.alertLevel}
          onChange={(e) => onChange({ alertLevel: e.target.value as Settings['alertLevel'] })}
          className="rounded border border-line bg-panel2 px-2 py-1 text-white"
        >
          <option value="STRONG">STRONG signals only</option>
          <option value="ANY">All signals</option>
        </select>
      </label>

      <h2 className="panel-title pt-2">Overlays</h2>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <Toggle label="Nadaraya-Watson" checked={settings.showNadaraya} onChange={toggle('showNadaraya')} />
        <Toggle label="EMA 20/50/200" checked={settings.showEma} onChange={toggle('showEma')} />
        <Toggle label="OB / FVG zones" checked={settings.showZones} onChange={toggle('showZones')} />
        <Toggle label="Fibonacci" checked={settings.showFib} onChange={toggle('showFib')} />
        <Toggle label="BOS / CHoCH" checked={settings.showStructure} onChange={toggle('showStructure')} />
      </div>
    </section>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  disabled,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label className={`flex cursor-pointer items-center justify-between gap-2 ${disabled ? 'opacity-50' : ''}`}>
        <span className="text-muted">{label}</span>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          disabled={disabled}
          onClick={onChange}
          className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${checked ? 'bg-gold' : 'bg-line'}`}
        >
          <span
            className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${checked ? 'left-3.5' : 'left-0.5'}`}
          />
        </button>
      </label>
      {hint && <p className="mt-0.5 text-[10px] text-bear/80">{hint}</p>}
    </div>
  );
}
