// rateUs.js — модальное окно «Спасибо за помощь!» (Rate Us prompt).
//
// Когда показываем (см. shouldShowOnLevelStart):
//   - игрок ещё ни разу не нажимал «Оценить» (флаг 02words_rated);
//   - текущая игровая сессия не первая (sessionNumber > 1);
//   - в этой сессии игрок только что завершил ровно 2 уровня и переходит к 3-му;
//   - в этой сессии окно ещё не открывалось.
//
// Что такое «игровая сессия»: одно открытие страницы. Считается через
// sessionStorage-маркер (живёт пока вкладка открыта, переживает F5/back-forward,
// обнуляется при закрытии вкладки/приложения). При первом обнаружении
// «новой» сессии инкрементируем счётчик в localStorage (02words_session_count).
//
// Хранение — отдельные ключи, не часть схемы storage.js. Это сознательно:
//   1) проще тестировать (cheat reset работает гранулярно);
//   2) не плодим миграции schema_version.
//
// Конфликт с интерстишиал-рекламой решается на стороне ui.js:
// если shouldShowOnLevelStart() === true, рекламу мы НЕ запускаем
// (см. обработчик win-next в ui.js).

const KEY_RATED = '02words_rated';                  // '1' если игрок нажал «Оценить»
const KEY_SESSION_COUNT = '02words_session_count';  // монотонный счётчик игровых сессий
const SESSION_MARK = '02words_session_started';     // sessionStorage-флаг текущей сессии

let shownThisSession = false;
let sessionNumberCached = null;

function safeRead(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeWrite(key, val) {
  try { localStorage.setItem(key, val); } catch {}
}
function safeRemove(key) {
  try { localStorage.removeItem(key); } catch {}
}

// ===== Состояние «уже оценил» =====

export function isRated() {
  return safeRead(KEY_RATED) === '1';
}

export function markRated() {
  safeWrite(KEY_RATED, '1');
}

// ===== Счётчик игровых сессий =====

// Вызывается один раз при старте mountGame. Идемпотентно для одной сессии:
// первый вызов в новой сессии увеличит счётчик; повторные (например, в случае
// HMR/перерисовки) — нет.
export function bumpSessionIfNew() {
  if (sessionNumberCached !== null) return sessionNumberCached;
  let marked = null;
  try { marked = sessionStorage.getItem(SESSION_MARK); } catch {}
  if (marked === '1') {
    // Та же сессия (reload без закрытия вкладки) — просто читаем счётчик.
    sessionNumberCached = parseInt(safeRead(KEY_SESSION_COUNT) || '1', 10) || 1;
    return sessionNumberCached;
  }
  // Новая игровая сессия.
  const prev = parseInt(safeRead(KEY_SESSION_COUNT) || '0', 10) || 0;
  const next = prev + 1;
  safeWrite(KEY_SESSION_COUNT, String(next));
  try { sessionStorage.setItem(SESSION_MARK, '1'); } catch {}
  sessionNumberCached = next;
  return next;
}

export function getSessionNumber() {
  if (sessionNumberCached !== null) return sessionNumberCached;
  return parseInt(safeRead(KEY_SESSION_COUNT) || '0', 10) || 0;
}

// ===== Главный gate =====

// sessionLevelsCompleted — сколько уровней игрок ЗАВЕРШИЛ в этой сессии
// (увеличивается в ui.js по нажатию «Дальше» на экране победы).
// Окно показываем перед стартом 3-го уровня сессии → когда счётчик === 2.
export function shouldShowOnLevelStart(sessionLevelsCompleted) {
  if (isRated()) return false;
  if (shownThisSession) return false;
  if (getSessionNumber() <= 1) return false;       // первая сессия — пропускаем
  if (sessionLevelsCompleted !== 2) return false;  // не тот момент сессии
  return true;
}

// ===== Сброс (для cheat reset) =====

export function clearAll() {
  safeRemove(KEY_RATED);
  safeRemove(KEY_SESSION_COUNT);
  try { sessionStorage.removeItem(SESSION_MARK); } catch {}
  shownThisSession = false;
  sessionNumberCached = null;
}

// ===== Показ окна =====
//
// Возвращает Promise, который резолвится:
//   { action: 'rate' }  — игрок нажал «Оценить» (флаг rated выставлен);
//   { action: 'later' } — игрок нажал «Может позже» (молча закрываем).
//
// Кнопка «Оценить» дополнительно пробует открыть страницу приложения в сторе
// через нативный bridge (если он есть). В браузерном dev-режиме просто
// логируем — позже добавится реальный переход в РуСтор.
export function showRateUsDialog() {
  shownThisSession = true;

  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'dialog rate-us-overlay';
    overlay.innerHTML = `
      <div class="dialog-card rate-us-card">
        <h3 class="rate-us-title">Спасибо за помощь!</h3>
        <div class="rate-us-stars" aria-hidden="true">
          <span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>
        </div>
        <p class="rate-us-desc">
          Оценки <span class="rate-us-highlight">5-звёзд</span> очень важны для развития нашего проекта!
        </p>
        <button class="rate-us-rate-btn" id="rate-us-rate" type="button">Оценить</button>
        <button class="rate-us-later-btn" id="rate-us-later" type="button">Может позже</button>
      </div>
    `;
    document.body.appendChild(overlay);

    const finish = (action) => {
      overlay.remove();
      resolve({ action });
    };

    overlay.querySelector('#rate-us-rate').addEventListener('click', () => {
      markRated();
      // Заглушка под открытие стора. Когда добавим bridge через html2apk
      // (типа -RustoreBridge), сюда подставится реальный вызов.
      try {
        if (window.AppStore && typeof window.AppStore.openListing === 'function') {
          window.AppStore.openListing();
        } else {
          console.log('[rateUs] would open store listing here');
        }
      } catch (e) {
        console.warn('[rateUs] openListing failed:', e);
      }
      finish('rate');
    });

    overlay.querySelector('#rate-us-later').addEventListener('click', () => finish('later'));
  });
}
