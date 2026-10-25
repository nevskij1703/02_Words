// pushScheduler.js — менеджер локальных пуш-уведомлений для casual-игр.
//
// ES-module вариант. Та же логика — inline в 01_RS_GlitterSort/index.html,
// в 06_Sudoku/pushScheduler.js и в _shared/push/pushScheduler.iife.js.
//
// Контракт Java -> JS:
//   window.__localNotificationsCallback(kind, data)
//
// Публичное API (export):
//   configure({appName, templates, maxPerDay, storageKey, getEnabled, setEnabled})
//   requestPermission() → Promise<'granted'|'denied'>
//   refresh()           — очередь заново: снять всё, разложить от «сейчас»
//   setEnabled(v)
//   isEnabled() → bool
//   getPermissionState() → 'granted'|'denied'|'not_requested'
//
// РАСПИСАНИЕ. Точка отсчёта — «сейчас», то есть возможный уход из игры:
//   - в день ухода больше ничего;
//   - следующие три дня — по два, утром и вечером;
//   - дальше — по одному вечером до конца горизонта (7 дней);
//   - у последнего неизменная фраза (шаблон с `tail: true`): его мост
//     повторяет каждые сутки сам, поэтому по одному в день идёт и дальше —
//     пока человек не зайдёт.
//
// РЕЖИМ МОСТА `setManaged` ОБЯЗАТЕЛЕН. Без него мост html2apk продлевает на
// сутки КАЖДОЕ сработавшее напоминание, и план на дни вперёд размножается: на
// N-й день без захода по N копий в слот, через неделю — 28 в день. А его
// страховочная задача раз в сутки досыпает «Не забудь про игру» в пустую
// очередь, то есть и выключившему напоминания. В режиме мост продлевает только
// последнее в очереди и пустую очередь не трогает (SKILL
// connect-local-notifications, раздел про setManaged).

const SLOT_WINDOWS = {
  morning: { hour: 9,  minute: 0,  spreadMinutes: 90 },
  evening: { hour: 19, minute: 30, spreadMinutes: 90 }
};
// rank 1 — самый нужный: потолок в день (maxPerDay) оставляет слоты с рангом
// не выше него. Вечер первым — в игру садятся, когда дела сделаны.
const PLAN_SLOTS = [
  { slot: 'morning', rank: 2 },
  { slot: 'evening', rank: 1 }
];
const HORIZON_DAYS = 7;       // дней после дня ухода в очереди; дальше мост повторяет последнее
const TWICE_DAILY_DAYS = 3;   // столько дней после дня ухода — по два
// Сутки расписания начинаются в 4:00: ушедший в час ночи ушёл «вчера», и
// наступающее утро для него уже первый день, а не день ухода.
const DAY_START_HOUR = 4;
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

/** Полночь суток расписания, в которые попадает момент t (граница — 4:00). */
function scheduleDay(t) {
  const d = new Date(t - DAY_START_HOUR * 3600 * 1000);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// День прибавляется номером в календаре, а не миллисекундами: переход на
// летнее время сдвинул бы весь список на час.
function slotDate(slot, day0, dayOffset) {
  const w = SLOT_WINDOWS[slot];
  const offsetMin = Math.floor(Math.random() * (w.spreadMinutes + 1));
  return new Date(day0.getFullYear(), day0.getMonth(), day0.getDate() + dayOffset,
                  w.hour, w.minute + offsetMin, 0, 0);
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

/**
 * Расписание от момента now: [{ id, at, tmpl }] по времени. Каждый слот — не
 * чаще раза в сутки; у последнего — неизменная фраза (шаблон `tail: true`).
 */
function planPushes(now, cap, state, gameState) {
  const out = [];
  if (!(cap > 0)) return out;
  const day0 = scheduleDay(now);
  for (let d = 1; d <= HORIZON_DAYS; d++) {
    const perDay = Math.min(cap, d <= TWICE_DAILY_DAYS ? 2 : 1);
    for (const s of PLAN_SLOTS) {
      if (s.rank > perDay) continue;
      const at = slotDate(s.slot, day0, d);
      if (at.getTime() <= now + 60_000) continue;
      const tmpl = pickTemplateForSlot(s.slot, at, state, gameState);
      if (!tmpl) continue;
      state.shownAt[tmpl.id] = at.getTime();
      // id уникален в пределах горизонта: номер местных суток и ранг слота
      const dayNo = Math.floor((at.getTime() - at.getTimezoneOffset() * 60_000) / 86_400_000);
      out.push({ id: (dayNo % 100000) * 10 + s.rank, at, tmpl });
    }
  }
  out.sort((a, b) => a.at - b.at);
  const tail = templates.find(t => t.tail);
  if (tail && out.length) out[out.length - 1].tmpl = tail;
  return out;
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
  refresh();
}

/**
 * Очередь заново: снять ВСЁ и разложить от «сейчас». Зовётся на запуске, на
 * входе и уходе, после уровня и с тумблера — в любом состоянии: выключенному
 * и без разрешения она только снимает очередь. В ней может лежать то, что мост
 * дописал сам, в том числе у прежних версий игры.
 */
export function refresh(gameState) {
  if (!hasBridge()) return;
  const bridge = window.LocalNotifications;
  try {
    if (typeof bridge.setManaged === 'function') bridge.setManaged(true);
    bridge.cancelAll();
  } catch (e) {
    console.warn('[push] очередь не снялась', e);
    return;
  }
  if (!isEnabled()) { console.log('[push] refresh: disabled'); return; }
  if (getPermissionState() !== 'granted') {
    console.log('[push] refresh: permission=' + getPermissionState());
    return;
  }
  if (!templates.length) { console.warn('[push] no templates'); return; }

  const state = readState();
  const scheduledLog = [];
  for (const p of planPushes(Date.now(), maxPerDay, state, gameState)) {
    try {
      // 5-й аргумент templateId — для push attribution (analytics push_opened event).
      bridge.schedule(p.id, p.tmpl.title, p.tmpl.body, p.at.getTime(), p.tmpl.id);
    } catch (e) {
      console.warn('[push] schedule failed', p.tmpl.id, e);
      continue;
    }
    scheduledLog.push({ id: p.tmpl.id, at: p.at.toLocaleString(), title: p.tmpl.title });
  }
  state.lastScheduled = Date.now();
  writeState(state);
  console.log('[push] scheduled ' + scheduledLog.length + ' notifications:', scheduledLog);
}
