// rustoreReview.js — обёртка над нативным RuStore In-App Review SDK с deep-link fallback.
//
// Архитектура:
//   native    — html2apk с -RuStoreReviewSdk экспонирует window.RuStoreReview.launch()
//               и шлёт результат в window.__rustoreReviewCallback(result, error).
//   fallback  — если bridge отсутствует (dev в браузере, APK без флага) или SDK
//               вернул 'unavailable' (нет RuStore / устарел) — window.open(deepLink).
//
// Контракт (Java -> JS):
//   window.__rustoreReviewCallback(result, error)
//     result: 'shown' | 'failed' | 'unavailable'
//     error:  null | строка с именем exception
//
//   'shown'       — диалог показан и закрыт юзером.
//   'failed'      — silent failure SDK (RuStoreReviewExists / Limit / Unauth / InvalidInfo).
//                   Fallback НЕ открывается — юзера не теребим.
//   'unavailable' — RuStore не установлен / устарел / factory упал → fallback на deep-link.
//
// Публичное API:
//   configure(appId) — вызвать один раз на старте (регистрирует callback + eager preload).
//   launch()         — Promise<{shown, fallbackUsed, error}>.

const DEEP_LINK_TEMPLATE = 'https://www.rustore.ru/catalog/app/';
// Таймаут на ожидание callback'а от Java. Без него Promise висит вечно,
// если Java тихо упал. RuStore диалог обычно закрывается за ~5-10 сек,
// 30s — комфортный запас на сетевую задержку + редкие медленные устройства.
const CALLBACK_TIMEOUT_MS = 30_000;

let appIdForFallback = null;
let pendingResolve = null;
let pendingTimer = null;
let callbackRegistered = false;

function setupCallback() {
  if (callbackRegistered) return;
  callbackRegistered = true;
  window.__rustoreReviewCallback = (result, error) => {
    console.log('[rustoreReview] callback:', result, error);
    if (!pendingResolve) {
      console.warn('[rustoreReview] callback without pending resolver');
      return;
    }
    const resolve = pendingResolve;
    pendingResolve = null;
    if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; }

    if (result === 'shown') {
      resolve({ shown: true, fallbackUsed: false, error: null });
    } else if (result === 'failed') {
      // Silent failure SDK — НЕ открываем deep-link.
      resolve({ shown: false, fallbackUsed: false, error });
    } else {
      // 'unavailable' — нет RuStore / устарел → fallback.
      openDeepLink();
      resolve({ shown: false, fallbackUsed: true, error });
    }
  };
}

function openDeepLink() {
  if (!appIdForFallback) {
    console.warn('[rustoreReview] no appId configured, skipping fallback');
    return;
  }
  try {
    window.open(DEEP_LINK_TEMPLATE + appIdForFallback,
                '_blank', 'noopener,noreferrer');
  } catch (e) {
    console.warn('[rustoreReview] deep-link open failed:', e);
  }
}

function hasBridge() {
  return !!(window.RuStoreReview
            && typeof window.RuStoreReview.launch === 'function');
}

/**
 * Зарегистрировать appId и запустить eager preload reviewInfo.
 * Идемпотентно. Вызывать один раз на старте приложения.
 * @param {string} appId — например, 'com.terekh.words'
 */
export function configure(appId) {
  appIdForFallback = appId;
  if (hasBridge()) {
    setupCallback();
    try { window.RuStoreReview.preload(); }
    catch (e) { console.warn('[rustoreReview] preload threw:', e); }
    console.log('[rustoreReview] backend=native, preload requested');
  } else {
    console.log('[rustoreReview] backend=fallback (no bridge — dev browser or APK without -RuStoreReviewSdk)');
  }
}

/**
 * Запросить показ нативного диалога оценки или fallback на deep-link.
 * Если уже есть pending — чейнится к существующему promise (анти-double-click).
 * @returns {Promise<{shown: boolean, fallbackUsed: boolean, error: string|null}>}
 */
export function launch() {
  // Анти-double-click: чейн к существующему resolver'у.
  if (pendingResolve) {
    return new Promise(resolve => {
      const prev = pendingResolve;
      pendingResolve = (r) => { prev(r); resolve(r); };
    });
  }

  if (!hasBridge()) {
    // Browser dev или APK без -RuStoreReviewSdk → fallback сразу.
    openDeepLink();
    return Promise.resolve({ shown: false, fallbackUsed: true, error: 'no_bridge' });
  }

  return new Promise(resolve => {
    pendingResolve = resolve;
    pendingTimer = setTimeout(() => {
      if (!pendingResolve) return;
      console.warn('[rustoreReview] callback timeout — fallback to deep-link');
      const r = pendingResolve;
      pendingResolve = null;
      pendingTimer = null;
      openDeepLink();
      r({ shown: false, fallbackUsed: true, error: 'callback_timeout' });
    }, CALLBACK_TIMEOUT_MS);
    try {
      window.RuStoreReview.launch();
    } catch (e) {
      console.warn('[rustoreReview] native launch threw:', e);
      if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; }
      pendingResolve = null;
      openDeepLink();
      resolve({ shown: false, fallbackUsed: true, error: 'launch_threw' });
    }
  });
}
