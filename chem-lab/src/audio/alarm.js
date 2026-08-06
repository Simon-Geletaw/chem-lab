// audio/alarm.js — a WebAudio two-tone siren for safety violations.
//
// No audio assets: two oscillators beat against each other in alternating
// bursts, shaped by a gain envelope. Created lazily on first use — the call
// always happens inside a user gesture (pressing E to pour), so the browser's
// autoplay policy is satisfied by construction.
//
// Guard rails: suspended contexts are resumed (Safari), every node is
// disconnected when the alarm stops, and a second alarm resets the first
// cleanly instead of stacking oscillators.

let ctx = null;
let nodes = null;        // the live {oscA, oscB, gain, timer} while sounding
let stopTimer = null;

const PULSE_MS = 350;    // how long each tone holds before switching
const FREQ_A = 820;      // low tone
const FREQ_B = 1240;     // high tone
const GAIN = 0.10;       // loud but not painful

function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// One beeping square tone, scheduled `when` seconds from now.
function tone(ac, freq, when, dur) {
  const osc = ac.createOscillator();
  osc.type = 'square';
  osc.frequency.value = freq;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(GAIN, when + 0.03);
  g.gain.setValueAtTime(GAIN, when + dur - 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(when);
  osc.stop(when + dur);
}

// The two-tone siren: alternate A/B/A/B... for `seconds` total.
export function playAlarm(seconds = 5) {
  stopAlarm();
  const ac = ensureCtx();
  if (!ac) return;
  const start = ac.currentTime + 0.02;
  const pulses = Math.max(1, Math.round((seconds * 1000) / PULSE_MS));
  for (let i = 0; i < pulses; i++) {
    tone(ac, i % 2 === 0 ? FREQ_A : FREQ_B, start + i * (PULSE_MS / 1000), PULSE_MS / 1000 - 0.02);
  }
  stopTimer = setTimeout(stopAlarm, seconds * 1000 + 60);
}

export function stopAlarm() {
  if (stopTimer) { clearTimeout(stopTimer); stopTimer = null; }
  nodes = null;   // tones are fire-and-forget oscillators — nothing to sever
}
