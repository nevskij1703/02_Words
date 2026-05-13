// audio.js — звуковые эффекты через Web Audio API.
// Никаких внешних файлов: всё синтезируется на лету осцилляторами.

import { CONFIG } from './config.js';
import { getSettings, setSetting } from './storage.js';

let ctx = null;
let masterGain = null;
let enabled = CONFIG.AUDIO.defaultEnabled;

function ensureContext() {
  if (ctx) return ctx;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
    masterGain = ctx.createGain();
    masterGain.gain.value = CONFIG.AUDIO.masterVolume;
    masterGain.connect(ctx.destination);
  } catch (err) {
    console.warn('[audio] no AudioContext:', err);
    ctx = null;
  }
  return ctx;
}

// Базовый "пим" с заданной частотой, длительностью, типом и огибающей.
function tone({ freq = 440, durMs = 120, type = 'sine', startGain = 0.6, attackMs = 5, releaseMs = 80, freqEnd = null, delayMs = 0 }) {
  if (!enabled) return;
  const c = ensureContext();
  if (!c) return;
  // Включить AudioContext после первого взаимодействия (mobile-policy).
  if (c.state === 'suspended') c.resume().catch(() => {});

  const t0 = c.currentTime + delayMs / 1000;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd) {
    osc.frequency.linearRampToValueAtTime(freqEnd, t0 + durMs / 1000);
  }
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(startGain, t0 + attackMs / 1000);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + (durMs + releaseMs) / 1000);

  osc.connect(g);
  g.connect(masterGain);
  osc.start(t0);
  osc.stop(t0 + (durMs + releaseMs) / 1000 + 0.02);
}

// === Звуки ===

const SOUNDS = {
  click() {
    tone({ freq: 600, durMs: 40, type: 'square', startGain: 0.15, releaseMs: 40 });
  },
  correct() {
    tone({ freq: 660,  durMs: 90, type: 'sine', startGain: 0.4, releaseMs: 60 });
    tone({ freq: 880,  durMs: 90, type: 'sine', startGain: 0.4, releaseMs: 60, delayMs: 90 });
    tone({ freq: 1100, durMs: 140, type: 'sine', startGain: 0.4, releaseMs: 120, delayMs: 180 });
  },
  bonus() {
    tone({ freq: 800, durMs: 70, type: 'triangle', startGain: 0.35, releaseMs: 60 });
    tone({ freq: 1200, durMs: 140, type: 'triangle', startGain: 0.35, releaseMs: 120, delayMs: 80 });
  },
  wrong() {
    tone({ freq: 320, freqEnd: 180, durMs: 200, type: 'sawtooth', startGain: 0.3, releaseMs: 80 });
  },
  win() {
    // C E G C — мажорное арпеджио.
    tone({ freq: 523, durMs: 120, type: 'triangle', startGain: 0.4 });
    tone({ freq: 659, durMs: 120, type: 'triangle', startGain: 0.4, delayMs: 120 });
    tone({ freq: 784, durMs: 120, type: 'triangle', startGain: 0.4, delayMs: 240 });
    tone({ freq: 1047, durMs: 240, type: 'triangle', startGain: 0.5, releaseMs: 220, delayMs: 360 });
  },
  hint() {
    tone({ freq: 1500, durMs: 80, type: 'sine', startGain: 0.3, releaseMs: 200 });
    tone({ freq: 2000, durMs: 80, type: 'sine', startGain: 0.3, releaseMs: 220, delayMs: 60 });
  }
};

export function play(name) {
  const fn = SOUNDS[name];
  if (fn) fn();
}

// Загружаем настройку «звук вкл/выкл» из storage при импорте.
export function initAudio() {
  const s = getSettings();
  enabled = !!s.sound;
}

export function isEnabled() {
  return enabled;
}

export function setEnabled(value) {
  enabled = !!value;
  setSetting('sound', enabled);
}

export function toggle() {
  setEnabled(!enabled);
  return enabled;
}

// Хелпер: «прогреть» AudioContext по первому касанию пользователя — без этого
// первый звук на мобиле может задержаться. Подключается в main.js.
export function primeOnFirstInteraction() {
  const handler = () => {
    ensureContext();
    if (ctx && ctx.state === 'suspended') ctx.resume();
    window.removeEventListener('pointerdown', handler);
    window.removeEventListener('keydown', handler);
  };
  window.addEventListener('pointerdown', handler, { once: true });
  window.addEventListener('keydown', handler, { once: true });
}
