// ads.js — рекламный менеджер с двумя backend'ами.
//
// Архитектура (см. docs/ADS.md):
//   native — html2apk с -YandexAdsBridge экспонирует window.YandexAds.*
//            и шлёт результаты в window.__yandexAdsCallback(kind, event).
//   mock   — DOM-оверлей для dev-режима в браузере.
//
// Расписание интерстишиалов (CONFIG.ADS):
//   - не показываем до перехода на CONFIG.ADS.interstitialMinLevel-й уровень
//     (zero-based). По умолчанию 3 → первая возможность = переход на L4.
//   - между двумя успешными показами — кулдаун CONFIG.ADS.interstitialCooldownMs
//     (2 минуты по умолчанию), хранится в памяти (сбрасывается с перезапуском).
//   - если игрок открыл рекламу и не вернулся (закрыл приложение), а
//     перезапустился в течение CONFIG.ADS.pendingResumeWindowMs, при первом
//     же старте уровня форсим показ.
//
// Контракт публичного API:
//   await initAds()                       → детектит backend + читает pending
//   await showInterstitialAd()            → resolves когда реклама закрыта
//   await showRewardedAd()                → { rewarded: true|false }
//   shouldShowInterstitial(levelIndex)    → boolean (минимум-уровень + кулдаун)
//   hasPendingResumeInterstitial()        → true если в прошлой сессии не
//                                            досмотрели и прошло мало времени
//   consumePendingResume()                → снимает флаг (без показа)
//   getBackend()                          → 'native' | 'mock'

import { CONFIG } from './config.js';

const PENDING_KEY = '02words_pending_interstitial';
// Таймаут на ожидание callback'а от Java. Без него Promise висит вечно
// (например, если SDK init не успел подняться или unit-ID на модерации,
// и onAdFailedToLoad по какой-то причине не дошёл). 30 сек — щедро,
// показ обычно укладывается в 5-15 сек включая loading.
const CALLBACK_TIMEOUT_MS = 30_000;

let backend = 'mock';
let pendingInterstitial = null;
let pendingRewarded = null;
let pendingInterstitialTimer = null;
let pendingRewardedTimer = null;
let lastInterstitialShownAt = 0;   // ms epoch, in-memory only (per session)
let pendingResumeFlag = false;     // взведён при initAds если нашли свежий pending

// Какой unit-ID использовать — реальный или Yandex demo. Demo всегда
// показывает тестовое объявление, поэтому полезен для проверки что
// SDK + bridge подняты корректно (см. CONFIG.ADS.useDemoUnits).
function pickInterstitialUnit() {
  return CONFIG.ADS.useDemoUnits ? CONFIG.ADS.unitInterstitialDemo : CONFIG.ADS.unitInterstitial;
}
function pickRewardedUnit() {
  return CONFIG.ADS.useDemoUnits ? CONFIG.ADS.unitRewardedDemo : CONFIG.ADS.unitRewarded;
}

function setupNativeCallback() {
  // Глобальный канал получения событий от Java-стороны.
  // Java вызывает: window.__yandexAdsCallback(kind, event)
  //   kind:  'interstitial' | 'rewarded'
  //   event: 'closed' | 'rewarded'
  window.__yandexAdsCallback = (kind, event) => {
    console.log('[ads] callback:', kind, event);
    if (kind === 'interstitial' && pendingInterstitial) {
      const resolve = pendingInterstitial;
      pendingInterstitial = null;
      if (pendingInterstitialTimer) { clearTimeout(pendingInterstitialTimer); pendingInterstitialTimer = null; }
      resolve({ shown: true });
    }
    if (kind === 'rewarded' && pendingRewarded) {
      const resolve = pendingRewarded;
      pendingRewarded = null;
      if (pendingRewardedTimer) { clearTimeout(pendingRewardedTimer); pendingRewardedTimer = null; }
      resolve({ rewarded: event === 'rewarded' });
    }
  };
}

function preloadInterstitial() {
  if (backend !== 'native') return;
  if (!window.YandexAds || typeof window.YandexAds.preloadInterstitial !== 'function') return;
  const unit = pickInterstitialUnit();
  try {
    console.log('[ads] preload interstitial unit=', unit);
    window.YandexAds.preloadInterstitial(unit);
  } catch (e) { console.warn('[ads] preload interstitial skipped:', e); }
}

function preloadRewarded() {
  if (backend !== 'native') return;
  if (!window.YandexAds || typeof window.YandexAds.preloadRewarded !== 'function') return;
  const unit = pickRewardedUnit();
  try {
    console.log('[ads] preload rewarded unit=', unit);
    window.YandexAds.preloadRewarded(unit);
  } catch (e) { console.warn('[ads] preload rewarded skipped:', e); }
}

function detectBackend() {
  if (CONFIG.ADS.useMock) {
    backend = 'mock';
    console.log('[ads] backend=mock (forced by CONFIG.ADS.useMock)');
    return;
  }
  if (window.YandexAds && typeof window.YandexAds.showInterstitial === 'function') {
    backend = 'native';
    setupNativeCallback();
    console.log('[ads] backend=native (YandexAds bridge detected)');
    // Preload первой пары реклам, чтобы первый показ был мгновенным.
    preloadInterstitial();
    preloadRewarded();
    return;
  }
  backend = 'mock';
  console.log('[ads] backend=mock (window.YandexAds not present — dev browser)');
}

// === Pending-resume utilities (localStorage) ===

function readPendingTs() {
  try { return parseInt(localStorage.getItem(PENDING_KEY) || '0', 10) || 0; }
  catch { return 0; }
}
function writePendingTs() {
  try { localStorage.setItem(PENDING_KEY, String(Date.now())); } catch {}
}
function clearPendingTs() {
  try { localStorage.removeItem(PENDING_KEY); } catch {}
}

// === Mock-реализация с DOM-оверлеем ===

function makeOverlay(text, durationMs) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'interstitial';
    const card = document.createElement('div');
    card.className = 'mock-ad';
    card.innerHTML = `<div>🎬 ${text}</div><div class="countdown">3</div>`;
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    let remaining = Math.ceil(durationMs / 1000);
    const counter = card.querySelector('.countdown');
    const interval = setInterval(() => {
      remaining--;
      if (counter) counter.textContent = String(Math.max(0, remaining));
    }, 1000);

    setTimeout(() => {
      clearInterval(interval);
      overlay.remove();
      resolve();
    }, durationMs);
  });
}

// === Публичный API ===

export async function initAds() {
  detectBackend();
  // Восстановление: если игрок не досмотрел интерстишиал в прошлой сессии
  // и перезапустил приложение быстро — форсим показ при первом загрузке уровня.
  const pendingAt = readPendingTs();
  const window_ = CONFIG.ADS.pendingResumeWindowMs || 5 * 60 * 1000;
  if (pendingAt && Date.now() - pendingAt < window_) {
    pendingResumeFlag = true;
  }
  // Чистим — pendingResumeFlag уже взведён (если был свежий), будет «использован»
  // через consumePendingResume() в ui.js.
  clearPendingTs();
}

export function hasPendingResumeInterstitial() {
  return pendingResumeFlag;
}

export function consumePendingResume() {
  const v = pendingResumeFlag;
  pendingResumeFlag = false;
  return v;
}

export async function showInterstitialAd() {
  // Когда реклама началась — пишем штамп в localStorage. Если приложение
  // умрёт (свернёт игрок), при следующем запуске мы это увидим.
  writePendingTs();
  // Триггер от resume больше не нужен — игрок до показа всё-таки дошёл.
  pendingResumeFlag = false;

  let result = { shown: false };
  try {
    if (backend === 'native') {
      const unit = pickInterstitialUnit();
      console.log('[ads] showInterstitial unit=', unit);
      result = await new Promise(resolve => {
        pendingInterstitial = resolve;
        // Защитный таймаут: если callback не пришёл за 30 сек — выдаём
        // shown:false и идём дальше, иначе UI ждал бы вечно.
        pendingInterstitialTimer = setTimeout(() => {
          if (pendingInterstitial) {
            console.warn('[ads] interstitial callback timeout — assume not shown');
            pendingInterstitial = null;
            pendingInterstitialTimer = null;
            resolve({ shown: false });
          }
        }, CALLBACK_TIMEOUT_MS);
        try {
          window.YandexAds.showInterstitial(unit);
        } catch (err) {
          console.warn('[ads] native interstitial failed', err);
          pendingInterstitial = null;
          if (pendingInterstitialTimer) { clearTimeout(pendingInterstitialTimer); pendingInterstitialTimer = null; }
          resolve({ shown: false });
        }
      });
    } else {
      await makeOverlay('Реклама (mock)', CONFIG.ADS.mockInterstitialDurationMs);
      result = { shown: true };
    }
  } finally {
    // Реклама закрыта — снимаем штамп, иначе на следующем запуске была бы
    // ложная сработка resume-логики.
    clearPendingTs();
  }

  // Кулдаун обновляем ТОЛЬКО если игрок реально досмотрел/закрыл рекламу
  // штатно (вернулся в приложение). Если показ упал с ошибкой — не запоминаем,
  // следующий старт уровня попытается снова.
  if (result && result.shown) {
    lastInterstitialShownAt = Date.now();
    // Подгружаем следующий заранее.
    preloadInterstitial();
  }
  return result;
}

export function showRewardedAd() {
  if (backend === 'native') {
    const unit = pickRewardedUnit();
    console.log('[ads] showRewarded unit=', unit);
    return new Promise(resolve => {
      pendingRewarded = resolve;
      // См. комментарий в showInterstitialAd — без таймаута Promise висит вечно.
      pendingRewardedTimer = setTimeout(() => {
        if (pendingRewarded) {
          console.warn('[ads] rewarded callback timeout — assume not granted');
          pendingRewarded = null;
          pendingRewardedTimer = null;
          resolve({ rewarded: false });
        }
      }, CALLBACK_TIMEOUT_MS);
      try {
        window.YandexAds.showRewarded(unit);
      } catch (err) {
        console.warn('[ads] native rewarded failed', err);
        pendingRewarded = null;
        if (pendingRewardedTimer) { clearTimeout(pendingRewardedTimer); pendingRewardedTimer = null; }
        resolve({ rewarded: false });
      }
    }).then(res => {
      // После показа подгружаем следующую rewarded-рекламу.
      preloadRewarded();
      return res;
    });
  }
  return makeOverlay('Просмотр за награду (mock)', CONFIG.ADS.mockRewardedDurationMs)
    .then(() => ({ rewarded: true }));
}

export function shouldShowInterstitial(levelIndex) {
  // Главный выключатель — interstitialMinLevel < 0 отключает все интерстишиалы.
  const minLevel = CONFIG.ADS.interstitialMinLevel;
  if (typeof minLevel !== 'number' || minLevel < 0) return false;
  // levelIndex — индекс уровня, на который только что переходит игрок.
  // По умолчанию minLevel=3 → первая возможность показа = переход на L4.
  if (levelIndex < minLevel) return false;
  // Кулдаун между двумя успешными показами в одной сессии.
  const cooldown = CONFIG.ADS.interstitialCooldownMs || 0;
  if (cooldown > 0 && lastInterstitialShownAt &&
      Date.now() - lastInterstitialShownAt < cooldown) {
    return false;
  }
  return true;
}

export function getBackend() {
  return backend;
}
