// ═══════════════════════════════════════════════════════════════════════════════
// Sound Engine — Web Audio API, zero audio files, fully offline
// ═══════════════════════════════════════════════════════════════════════════════

let ctx: AudioContext | null = null;

export function initAudio(): void {
  if (ctx) return;
  ctx = new AudioContext();
}

function getCtx(): AudioContext | null {
  if (ctx?.state === 'suspended') ctx.resume();
  return ctx;
}

function playTone(
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  gain = 0.1,
  freqEnd?: number,
): void {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime);
  if (freqEnd) osc.frequency.linearRampToValueAtTime(freqEnd, c.currentTime + duration);
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.linearRampToValueAtTime(0, c.currentTime + duration);
  osc.connect(g).connect(c.destination);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + duration);
}

// UI button click — crisp, short
export function playClick(): void {
  playTone(440, 0.08, 'sine', 0.08);
}

// XP gain — ascending arpeggio
export function playXP(): void {
  const c = getCtx();
  if (!c) return;
  [220, 440, 880].forEach((freq, i) => {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.1, c.currentTime + i * 0.07);
    g.gain.linearRampToValueAtTime(0, c.currentTime + i * 0.07 + 0.1);
    osc.connect(g).connect(c.destination);
    osc.start(c.currentTime + i * 0.07);
    osc.stop(c.currentTime + i * 0.07 + 0.1);
  });
}

// Milestone — major chord (C-E-G), sustained
export function playMilestone(): void {
  const c = getCtx();
  if (!c) return;
  [261.6, 329.6, 392].forEach((freq) => {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.08, c.currentTime);
    g.gain.linearRampToValueAtTime(0, c.currentTime + 0.6);
    osc.connect(g).connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + 0.6);
  });
}

// Turning point — ominous descending sweep
export function playTurningPoint(): void {
  playTone(880, 0.4, 'sawtooth', 0.08, 220);
}

// Reveal — dramatic low→high sweep
export function playReveal(): void {
  playTone(110, 0.8, 'sine', 0.12, 880);
}

// Decision made — thud + chime
export function playDecision(): void {
  const c = getCtx();
  if (!c) return;
  // Thud
  playTone(80, 0.1, 'sine', 0.15);
  // Chime (delayed)
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'triangle';
  osc.frequency.value = 1200;
  g.gain.setValueAtTime(0.06, c.currentTime + 0.07);
  g.gain.linearRampToValueAtTime(0, c.currentTime + 0.18);
  osc.connect(g).connect(c.destination);
  osc.start(c.currentTime + 0.07);
  osc.stop(c.currentTime + 0.18);
}

// Ambient drone — very quiet C2 pad
let ambientOsc: OscillatorNode | null = null;

export function playAmbient(): void {
  const c = getCtx();
  if (!c || ambientOsc) return;
  ambientOsc = c.createOscillator();
  const g = c.createGain();
  ambientOsc.type = 'sine';
  ambientOsc.frequency.value = 65.4;
  g.gain.value = 0.015;
  ambientOsc.connect(g).connect(c.destination);
  ambientOsc.start();
}

export function stopAmbient(): void {
  if (ambientOsc) {
    ambientOsc.stop();
    ambientOsc = null;
  }
}
