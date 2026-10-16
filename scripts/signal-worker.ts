/**
 * Headless signal worker: polls the configured data provider, runs the signal
 * engine on closed bars and pushes new signals to Telegram. Run it on any
 * always-on machine (VPS, Raspberry Pi, Railway/Fly.io) so alerts keep coming
 * when no browser is open:
 *
 *   npm run worker
 */
import { formatSignalMessage, sendTelegramMessage } from '../src/lib/alerts/telegram';
import { fetchCandles, resolveProvider } from '../src/lib/data/provider';
import { runEngine } from '../src/lib/signals/engine';
import { TIMEFRAME_SECONDS, isStrongSignal, isTimeframe, type Timeframe } from '../src/lib/types';

// Load .env.local / .env when present (Node >= 20.12).
for (const file of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(file);
  } catch {
    // File missing: rely on the real environment.
  }
}

const timeframes = (process.env.WORKER_TIMEFRAMES ?? '15m,1h')
  .split(',')
  .map((s) => s.trim())
  .filter(isTimeframe);
const minLevel = (process.env.WORKER_MIN_LEVEL ?? 'STRONG').toUpperCase() === 'ANY' ? 'ANY' : 'STRONG';
const intervalMs = Math.max(Number(process.env.WORKER_INTERVAL_MS) || 60_000, 5_000);
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

// Signals at or before this time per timeframe were already handled.
const lastSeen = new Map<Timeframe, number>();

async function tick(tf: Timeframe) {
  const { candles } = await fetchCandles(tf, 500);
  const now = Date.now() / 1000;
  const closed = candles.filter((c) => c.time + TIMEFRAME_SECONDS[tf] <= now);
  const { signals } = runEngine(closed);

  const since = lastSeen.get(tf);
  const latestTime = closed.at(-1)?.time ?? 0;
  lastSeen.set(tf, latestTime);
  // First run: only remember the history, do not alert on it.
  if (since === undefined) return;

  for (const s of signals) {
    if (s.time <= since) continue;
    if (minLevel === 'STRONG' && !isStrongSignal(s.signal)) continue;
    const text = formatSignalMessage(s, tf);
    console.log(`[${new Date().toISOString()}] ${tf} ${s.signal} @ ${s.price}`);
    if (token && chatId) await sendTelegramMessage(token, chatId, text);
  }
}

async function loop() {
  for (const tf of timeframes) {
    try {
      await tick(tf);
    } catch (err) {
      console.error(`[${tf}]`, err instanceof Error ? err.message : err);
    }
  }
}

const provider = resolveProvider();
console.log(
  `Signal worker: provider=${provider.name} timeframes=${timeframes.join(',')} level=${minLevel} every ${intervalMs}ms`,
);
if (!token || !chatId) console.warn('TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set: signals are logged only.');

void loop();
setInterval(() => void loop(), intervalMs);
