// Synthesised notification sounds — no audio files needed.
// Browsers keep audio locked until the user first clicks or types on the page.

let ctx = null;

function getCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

if (typeof window !== "undefined") {
  const unlock = () => {
    getCtx();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
}

function tone(freq, start, dur, { type = "sine", gain = 0.15 } = {}) {
  const c = getCtx();
  if (!c || c.state !== "running") return;
  const t0  = c.currentTime + start;
  const osc = c.createOscillator();
  const g   = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export const sounds = {
  // Two rising notes — "ding-ding"
  messageReceived: () => {
    tone(880, 0, 0.14);
    tone(1320, 0.11, 0.2);
  },
  // Short soft blip
  messageSent: () => {
    tone(620, 0, 0.07, { gain: 0.07 });
    tone(930, 0.05, 0.08, { gain: 0.05 });
  },
  // Bright triple chime that stands out from chat
  pingReceived: () => {
    tone(1046, 0,    0.12, { type: "triangle", gain: 0.22 });
    tone(1046, 0.16, 0.12, { type: "triangle", gain: 0.22 });
    tone(1568, 0.32, 0.3,  { type: "triangle", gain: 0.22 });
  },
  // Quick upward zap
  pingSent: () => {
    tone(1200, 0,    0.06, { type: "triangle", gain: 0.1 });
    tone(1700, 0.06, 0.12, { type: "triangle", gain: 0.1 });
  },
};

let ringTimer = null;

function ringOnce() {
  tone(784, 0,   0.3, { gain: 0.2 });
  tone(988, 0,   0.3, { gain: 0.1 });
  tone(784, 0.4, 0.3, { gain: 0.2 });
  tone(988, 0.4, 0.3, { gain: 0.1 });
}

export function startRingtone() {
  if (ringTimer) return;
  ringOnce();
  ringTimer = setInterval(ringOnce, 2000);
}

export function stopRingtone() {
  clearInterval(ringTimer);
  ringTimer = null;
}

// The chat window that's currently open already plays its own sound for new
// messages, so the background poll must not ring for that conversation too.
let openConversationId = null;
export const setOpenConversation = (id) => { openConversationId = id ?? null; };
export const getOpenConversation = () => openConversationId;
