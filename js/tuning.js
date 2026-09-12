// js/tuning.js — одно окно в удалённую конфигурацию для всей игры.
//
// Клиент лежит в `js/remote/` и приезжает из общего модуля `../admin` (копии
// генерируемые, править их здесь нельзя). Этот файл — наш, и он существует
// ради одного правила:
//
// ЗНАЧЕНИЕ ЧИТАЕТСЯ ПРИ ОБРАЩЕНИИ, А НЕ ЗАПОМИНАЕТСЯ ПРИ ЗАГРУЗКЕ МОДУЛЯ.
// Конфиг приезжает из сети через секунду-две после старта; снятое один раз в
// константу значение застыло бы навсегда, и правка в бакете не подействовала
// бы до перезапуска игры. Заметно это было бы не сразу и выглядело бы как
// «админка не работает».
//
// РЕЗЕРВ ОБЯЗАТЕЛЕН. `rc()` отдаёт undefined, пока игра не позвала
// `configure` — а её не зовут ни dev-панель, ни браузерный прогон логики. Без
// резерва они получили бы undefined там, где ждут число.
//
// Список ключей и их рамки — в `remote-config.json` в корне игры. Ключ без
// рамки клиент не применит, поэтому новый ключ надо объявить ТАМ, а не только
// здесь.

import { rc, rcDeclaration } from './remote/remoteConfig.js';
import { CONFIG } from './config.js';

/**
 * Значение из удалённой конфигурации, иначе константа сборки.
 *
 * @param {string} key      — ключ из remote-config.json
 * @param {number} fallback — константа из js/config.js
 * @returns {number}
 */
export function tuned(key, fallback) {
  const value = rc(key);
  return typeof value === 'number' ? value : fallback;
}

/**
 * СВЕРИТЬ ОБЪЯВЛЕНИЕ КОНФИГА С КОНСТАНТАМИ СБОРКИ. Только в дев-сборке.
 *
 * ЗАЧЕМ. Объявление (`remote-config.json`) пишется руками, а числа живут в
 * `js/config.js`. Разойтись они могут молча и с дорогими последствиями: дефолт
 * в объявлении — это то, что применится при недоступном бакете, и расхождение
 * означает «без сети игра ведёт себя иначе, чем с ней». Глазами это не
 * проверяется, а тратить на это отдельный тест незачем — хватает строки в
 * консоли при открытии игры.
 *
 * У Smash Banks и Hole такой пары нет: там объявление СОБИРАЕТСЯ из схем.
 */
export function warnDeclarationDrift() {
  if (typeof window !== 'undefined' && window.__BUILD_RELEASE__) return [];
  const decl = rcDeclaration();
  const A = CONFIG.ADS;
  const B = CONFIG.BALANCE;
  const actual = {
    interstitial_enabled: A.interstitialEnabled !== false ? 1 : 0,
    interstitial_min_level: A.interstitialMinLevel,
    interstitial_cooldown_sec: Math.round((A.interstitialCooldownMs || 0) / 1000),
    interstitial_pending_resume_min: Math.round((A.pendingResumeWindowMs || 0) / 60000),
    hints_start: B.startingHints,
    hints_per_rewarded: B.hintsPerRewardedAd,
    hints_refill_cap: B.hintsRefillCap,
    wrong_streak_for_hint_banner: B.wrongStreakForHintBanner,
    audio_master_volume: CONFIG.AUDIO.masterVolume,
    haptic_bad_word_ms: CONFIG.HAPTIC.badWordMs,
    haptic_correct_word_ms: CONFIG.HAPTIC.correctWordMs,
  };
  const drift = Object.keys(actual)
    .filter((key) => String(decl.defaults[key]) !== String(actual[key]))
    .map((key) => `${key}: в объявлении ${decl.defaults[key]}, в сборке ${actual[key]}`);
  if (drift.length) console.warn(`[remote-config] объявление разошлось со сборкой:\n  ${drift.join('\n  ')}`);
  return drift;
}
