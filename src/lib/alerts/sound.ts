let ctx: AudioContext | null = null;

/** Must be called from a user gesture once so browsers allow audio. */
export function unlockAudio(): void {
  if (typeof window === 'undefined') return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

/** Short two-tone chime: rising for buys, falling for sells. */
export function playAlert(direction: 1 | -1): void {
  unlockAudio();
  if (!ctx) return;
  const tones = direction === 1 ? [660, 990] : [990, 660];
  const start = ctx.currentTime;
  tones.forEach((freq, i) => {
    const osc = ctx!.createOscillator();
    const gain = ctx!.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const t = start + i * 0.18;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    osc.connect(gain).connect(ctx!.destination);
    osc.start(t);
    osc.stop(t + 0.17);
  });
}
