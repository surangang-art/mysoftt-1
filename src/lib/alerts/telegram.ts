import type { SignalEvent } from '../signals/engine';
import type { Timeframe } from '../types';

export async function sendTelegramMessage(token: string, chatId: string, html: string): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: 'HTML', disable_web_page_preview: true }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { description?: string };
    throw new Error(`Telegram: ${body.description ?? res.statusText}`);
  }
}

export function formatSignalMessage(signal: SignalEvent, tf: Timeframe): string {
  const emoji = signal.signal.includes('BUY') ? '🟢' : '🔴';
  const when = new Date(signal.time * 1000).toISOString().replace('T', ' ').slice(0, 16);
  const lines = [
    `${emoji} <b>XAU/USD ${signal.signal}</b> · ${tf}`,
    `Bar: ${when} UTC`,
    `Score: bull ${signal.bullScore} / bear ${signal.bearScore}`,
  ];
  const l = signal.levels;
  if (l) {
    lines.push(
      '',
      `Entry: <b>${l.entry.toFixed(2)}</b>`,
      `SL: ${l.stopLoss.toFixed(2)}`,
      `TP1: ${l.tp1.toFixed(2)} (${l.rr[0]}R)`,
      `TP2: ${l.tp2.toFixed(2)} (${l.rr[1]}R)`,
      `TP3: ${l.tp3.toFixed(2)} (${l.rr[2]}R)`,
    );
  }
  const reasons = signal.components
    .filter((c) => (signal.signal.includes('BUY') ? c.bull : c.bear) > 0)
    .map((c) => `• ${escapeHtml(c.label)}`);
  if (reasons.length) lines.push('', ...reasons);
  lines.push('', '<i>Not financial advice.</i>');
  return lines.join('\n');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
