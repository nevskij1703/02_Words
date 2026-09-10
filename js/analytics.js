// js/analytics.js — Yandex AppMetrica wrapper (ES-module).
//
// Контракт см. в skill `connect-appmetrica` и docs/ANALYTICS.md.
// JS-обёртка над нативным `window.AppMetrica` (bridge через html2apk
// -YandexAppMetrica). В browser dev (нет window.AppMetrica) — mock-mode:
// все события идут в console.log, чтобы можно было отлаживать без устройства.

let configured = false;

/**
 * Группы A/B этого устройства — 'pacing:often'. Уходит параметром `ab` в
 * КАЖДОМ событии, и без этого тест бессмыслен: разбиение есть, а сравнить
 * группы нечем.
 *
 * Отдельным сеттером, а не полем configure: контекст заводится сразу, а
 * группы приезжают из сети и позже.
 */
let abLabel = '';

export function setAbCohorts(label) {
  abLabel = label || '';
}

const ctx = {
  appName: 'unknown',
  appVersion: '1.0.0',
  platform: (typeof window !== 'undefined' && window.AppMetrica) ? 'android' : 'browser',
  userId: null
};

/**
 * Одноразовая инициализация. Вызывается в bootstrap'е после storage.load().
 * @param {{appName: string, appVersion?: string, userId: string}} opts
 */
export function configure(opts = {}) {
  if (opts.appName)    ctx.appName    = opts.appName;
  if (opts.appVersion) ctx.appVersion = opts.appVersion;
  if (opts.userId)     ctx.userId     = opts.userId;
  configured = true;
  if (window.AppMetrica && ctx.userId) {
    try { window.AppMetrica.setUserProfileID(String(ctx.userId)); }
    catch (e) { console.warn('[analytics] setUserProfileID failed:', e); }
  }
  if (!window.AppMetrica) {
    console.log('[analytics] configured (browser mock):', ctx);
  }
  // Push attribution: cold-start case — приложение открыто кликом по push.
  // Warm-start (юзер сворачивал и тапнул нотификацию) — через visibilitychange.
  // См. SKILL connect-appmetrica → секция «Push attribution».
  checkPushOpenedAttribution();
  if (!visibilityHooked && typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkPushOpenedAttribution();
    });
    visibilityHooked = true;
  }
}

let visibilityHooked = false;
function checkPushOpenedAttribution() {
  if (!window.LocalNotifications || typeof window.LocalNotifications.consumePushTemplateId !== 'function') return;
  try {
    const tid = window.LocalNotifications.consumePushTemplateId();
    if (tid) {
      event('push_opened', { template_id: tid });
    }
  } catch (e) {
    console.warn('[analytics] consumePushTemplateId failed:', e);
  }
}

/**
 * Шлёт ивент в AppMetrica с системными параметрами (app_name, app_version,
 * platform, user_id). Если bridge недоступен — пишет в console.log.
 * @param {string} name
 * @param {Object} [params]
 */
export function event(name, params = {}) {
  if (!configured) console.warn('[analytics] event before configure():', name);
  const payload = {
    ...params,
    app_name:    ctx.appName,
    app_version: ctx.appVersion,
    platform:    ctx.platform,
    user_id:     ctx.userId,
    ab:          abLabel
  };
  if (window.AppMetrica) {
    try { window.AppMetrica.reportEvent(name, JSON.stringify(payload)); }
    catch (e) { console.warn('[analytics] reportEvent failed:', name, e); }
  } else {
    console.log('[analytics]', name, payload);
  }
}

/**
 * Shortcut для рекламных событий — мапит type на правильное имя ивента.
 * @param {{type: 'interstitial'|'rewarded', placement: string, watched?: boolean, rewardGiven?: boolean}} opts
 */
export function adShown({ type, placement = 'unknown', watched = true, rewardGiven = true } = {}) {
  const kind = type === 'rewarded' ? 'ad_rewarded_shown' : 'ad_interstitial_shown';
  const params = { placement };
  if (type === 'rewarded') {
    params.watched      = !!watched;
    params.reward_given = !!rewardGiven;
  }
  event(kind, params);
}

/** Сообщает об ошибке (попадает в Crashes/Errors в AppMetrica dashboard). */
export function error(message, details) {
  if (window.AppMetrica) {
    try { window.AppMetrica.reportError(String(message || ''), String(details || '')); }
    catch (e) { console.warn('[analytics] reportError failed:', e); }
  } else {
    console.log('[analytics] error', message, details);
  }
}

/** Обновляет user profile ID (наш UUID). */
export function setUser(id) {
  ctx.userId = id;
  if (window.AppMetrica) {
    try { window.AppMetrica.setUserProfileID(String(id)); }
    catch (e) { console.warn('[analytics] setUser failed:', e); }
  }
}
