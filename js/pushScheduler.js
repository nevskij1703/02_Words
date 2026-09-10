// pushScheduler.js — менеджер локальных пуш-уведомлений для casual-игр.
//
// ES-module вариант (для 02_Words, других ES-проектов). Логика идентична
// IIFE-варианту в _shared/push/pushScheduler.iife.js — см. подробные
// комментарии там.
//
// Контракт Java -> JS:
//   window.__localNotificationsCallback(kind, data)
//
// Публичное API (export):
//   configure({appName, templates, maxPerDay, storageKey, getEnabled, setEnabled})
//   requestPermission() → Promise<'granted'|'denied'>
//   refresh()           — переплан расписания на 48ч вперёд
//   setEnabled(v)
//   isEnabled() → bool
//   getPermissionState() → 'granted'|'denied'|'not_requested'

const SLOT_WINDOWS = {
  morning: { hour: 9,  minute: 0,  spreadMinutes: 90 },
  lunch:   { hour: 13, minute: 0,  spreadMinutes: 60 },
  evening: { hour: 19, minute: 30, spreadMinutes: 90 },
  night:   { hour: 22, minute: 30, spreadMinutes: 30 }
};
const HORIZON_HOURS = 168;  // 7 дней — даёт юзеру неделю «тишины» прежде чем последний пуш в очереди отгорит. Главный механизм поддержки цепочки — auto-reschedule в Java NotificationReceiver, см. SKILL `connect-local-notifications` секция Auto-chain.
const DEFAULT_MAX_PER_DAY = 4;

let appName = 'Game';
let templates = [];
let maxPerDay = DEFAULT_MAX_PER_DAY;
let storageKey = 'push_scheduler';
let getEnabledFn = null;   // injected by configure
let setEnabledFn = null;
let pendingPermissionResolve = null;
let callbackRegistered = false;

function hasBridge() {
  return !!(window.LocalNotifications
            && typeof window.LocalNotifications.schedule === 'function');
}

function setupCallback() {
  if (callbackRegistered) return;
  callbackRegistered = true;
  window.__localNotificationsCallback = (kind, data) => {
    console.log('[push] callback:', kind, data);
    if (kind === 'permission' && pendingPermissionResolve) {
      const resolve = pendingPermissionResolve;
      pendingPermissionResolve = null;
      resolve(data);
    }
  };
}

function readState() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { shownAt: {}, lastScheduled: 0 };
    return JSON.parse(raw);
  } catch (e) {
    return { shownAt: {}, lastScheduled: 0 };
  }
}
function writeState(s) {
  try { localStorage.setItem(storageKey, JSON.stringify(s)); }
  catch (e) { console.warn('[push] state write failed', e); }
}

function nextSlotDate(slot, baseDate) {
  const w = SLOT_WINDOWS[slot];
  if (!w) return null;
  const d = new Date(baseDate);
  const offsetMin = Math.floor(Math.random() * (w.spreadMinutes + 1));
  d.setHours(w.hour, w.minute + offsetMin, 0, 0);
  if (d.getTime() <= Date.now() + 60_000) {
    d.setDate(d.getDate() + 1);
    const off2 = Math.floor(Math.random() * (w.spreadMinutes + 1));
    d.setHours(w.hour, w.minute + off2, 0, 0);
  }
  return d;
}

function isWeekdayMatch(template, date) {
  const dow = date.getDay();
  const w = template.weekdays;
  if (!w || w === 'any') return true;
  if (w === 'weekend') return dow === 0 || dow === 6;
  if (w === 'weekday') return dow >= 1 && dow <= 5;
  if (Array.isArray(w)) return w.indexOf(dow) >= 0;
  return true;
}

function pickTemplateForSlot(slot, date, state, gameState) {
  const now = Date.now();
  const candidates = templates.filter(t => {
    if (t.slot !== slot) return false;
    if (!isWeekdayMatch(t, date)) return false;
    if (typeof t.requires === 'function') {
      try { if (!t.requires(gameState || {})) return false; }
      catch (e) { return false; }
    }
    return true;
  });
  if (!candidates.length) return null;

  function ageOf(t) {
    const last = state.shownAt[t.id] || 0;
    const cooldownMs = (t.cooldownDays || 1) * 24 * 3600 * 1000;
    const elapsed = now - last;
    return elapsed < cooldownMs ? (elapsed - cooldownMs) : elapsed;
  }

  candidates.sort((a, b) => {
    const da = ageOf(a), db = ageOf(b);
    if (db !== da) return db - da;
    return (b.weight || 1) - (a.weight || 1);
  });
  return candidates[0];
}

function hashId(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) & 0x7fffffff;
  }
  return h;
}

// ---------- Public API ----------

export function configure(opts) {
  if (!opts) return;
  appName = opts.appName || appName;
  templates = Array.isArray(opts.templates) ? opts.templates : [];
  maxPerDay = (typeof opts.maxPerDay === 'number') ? opts.maxPerDay : DEFAULT_MAX_PER_DAY;
  storageKey = opts.storageKey || storageKey;
  getEnabledFn = (typeof opts.getEnabled === 'function') ? opts.getEnabled : null;
  setEnabledFn = (typeof opts.setEnabled === 'function') ? opts.setEnabled : null;
  setupCallback();
  console.log('[push] configured: ' + templates.length + ' templates, maxPerDay=' + maxPerDay
              + ', backend=' + (hasBridge() ? 'native' : 'mock'));
}

export function getPermissionState() {
  if (!hasBridge()) return 'denied';
  try { return window.LocalNotifications.getPermissionState() || 'denied'; }
  catch (e) { return 'denied'; }
}

export function requestPermission() {
  if (!hasBridge()) return Promise.resolve('denied');
  if (pendingPermissionResolve) {
    return new Promise(resolve => {
      const prev = pendingPermissionResolve;
      pendingPermissionResolve = (r) => { prev(r); resolve(r); };
    });
  }
  return new Promise(resolve => {
    pendingPermissionResolve = resolve;
    try { window.LocalNotifications.requestPermission(); }
    catch (e) {
      pendingPermissionResolve = null;
      resolve('denied');
    }
    setTimeout(() => {
      if (pendingPermissionResolve === resolve || pendingPermissionResolve) {
        const r = pendingPermissionResolve;
        pendingPermissionResolve = null;
        if (r) r('denied');
      }
    }, 60_000);
  });
}

export function isEnabled() {
  if (typeof getEnabledFn === 'function') return !!getEnabledFn();
  const s = readState();
  return s.enabled !== false;
}

export function setEnabled(v) {
  if (typeof setEnabledFn === 'function') setEnabledFn(!!v);
  else {
    const s = readState();
    s.enabled = !!v;
    writeState(s);
  }
  if (!v) {
    if (hasBridge()) {
      try { window.LocalNotifications.cancelAll(); } catch (e) {}
    }
  } else {
    refresh();
  }
}

export function refresh(gameState) {
  if (!isEnabled()) { console.log('[push] refresh skipped: disabled'); return; }
  if (getPermissionState() !== 'granted') {
    console.log('[push] refresh skipped: permission=' + getPermissionState());
    return;
  }
  if (!templates.length) { console.warn('[push] no templates'); return; }

  if (hasBridge()) {
    try { window.LocalNotifications.cancelAll(); } catch (e) {}
  }

  const state = readState();
  const slots = ['morning', 'lunch', 'evening', 'night'];
  const days = Math.ceil(HORIZON_HOURS / 24);
  let scheduled = 0;
  const scheduledLog = [];

  for (let dayOffset = 0; dayOffset < days; dayOffset++) {
    let perDay = 0;
    for (let i = 0; i < slots.length && perDay < maxPerDay; i++) {
      const slot = slots[i];
      const base = new Date();
      base.setDate(base.getDate() + dayOffset);
      const at = nextSlotDate(slot, base);
      if (!at) continue;
      if (at.getTime() > Date.now() + HORIZON_HOURS * 3600 * 1000) continue;
      if (at.getTime() <= Date.now() + 30_000) continue;

      const tmpl = pickTemplateForSlot(slot, at, state, gameState);
      if (!tmpl) continue;

      const numId = hashId(tmpl.id) ^ Math.floor(at.getTime() / 60000);
      if (hasBridge()) {
        try {
          // 5-й аргумент templateId — для push attribution (analytics push_opened event).
          window.LocalNotifications.schedule(numId | 0, tmpl.title, tmpl.body, at.getTime(), tmpl.id);
        } catch (e) {
          console.warn('[push] schedule failed', tmpl.id, e);
          continue;
        }
      }
      state.shownAt[tmpl.id] = at.getTime();
      scheduled++;
      perDay++;
      scheduledLog.push({ id: tmpl.id, slot, at: at.toLocaleString(), title: tmpl.title });
    }
  }

  state.lastScheduled = Date.now();
  writeState(state);
  console.log('[push] scheduled ' + scheduled + ' notifications:', scheduledLog);
}
