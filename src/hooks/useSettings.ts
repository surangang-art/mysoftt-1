'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Timeframe } from '@/lib/types';

export interface Settings {
  timeframe: Timeframe;
  soundEnabled: boolean;
  telegramEnabled: boolean;
  /** STRONG: only STRONG BUY/SELL raise alerts. ANY: every new signal. */
  alertLevel: 'STRONG' | 'ANY';
  showNadaraya: boolean;
  showEma: boolean;
  showZones: boolean;
  showFib: boolean;
  showStructure: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  timeframe: '15m',
  soundEnabled: false,
  telegramEnabled: false,
  alertLevel: 'STRONG',
  showNadaraya: true,
  showEma: true,
  showZones: true,
  showFib: true,
  showStructure: true,
};

const KEY = 'xau-terminal-settings';

/** Per-browser preferences, persisted to localStorage when available. */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setSettings({ ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) });
    } catch {
      // Storage unavailable (private mode, blocked): keep defaults.
    }
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // Ignore: settings still apply for this session.
      }
      return next;
    });
  }, []);

  return [settings, update] as const;
}
