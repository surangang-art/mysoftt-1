import { NextResponse, type NextRequest } from 'next/server';
import { sendTelegramMessage } from '@/lib/alerts/telegram';

export const dynamic = 'force-dynamic';

const MAX_LENGTH = 3500;
const MIN_INTERVAL_MS = 3000;
let lastSentAt = 0;

/** Whether Telegram alerts are configured on the server. */
export async function GET() {
  return NextResponse.json({
    configured: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
  });
}

/**
 * Relays a signal message to the configured chat. The bot token never reaches the
 * browser. Messages are length-limited and throttled to keep this endpoint from
 * being used to spam the chat.
 */
export async function POST(req: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return NextResponse.json({ error: 'Telegram is not configured on the server' }, { status: 503 });
  }

  const body = (await req.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === 'string' ? body.text.slice(0, MAX_LENGTH) : '';
  if (!text) return NextResponse.json({ error: 'Missing text' }, { status: 400 });

  const now = Date.now();
  if (now - lastSentAt < MIN_INTERVAL_MS) {
    return NextResponse.json({ error: 'Too many alerts, slow down' }, { status: 429 });
  }
  lastSentAt = now;

  try {
    await sendTelegramMessage(token, chatId, text);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Telegram request failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
