// storage.js — обёртка над localStorage с системой миграций сейва.
// См. docs/SAVES.md (контракт) и js/migrations.js (реестр миграций).

import { CONFIG } from './config.js';
import { runMigrations, getCurrentSchemaVersion } from './migrations.js';

const STORAGE_KEY = '02words_save';

const DEFAULT_STATE = () => ({
  schemaVersion: getCurrentSchemaVersion(),
  currentLevel: 0,
  completedLevels: [],          // [levelId, ...]
  // Значение СБОРКИ. Ключ `hints_start` правит его не здесь, а один раз после
  // ответа сети — см. `applyStartGrant` ниже.
  hints: CONFIG.BALANCE.startingHints,
  // Поправка стартового запаса из конфига ещё не применялась. См. migration[4].
  startAdjusted: false,
  foundBonusByLevel: {},        // { [levelId]: ['СЛОВО', ...] }
  revealedCellsByLevel: {},     // { [levelId]: [[row, col], ...] }
  stats: { levelsCompleted: 0, wordsFound: 0 },
  settings: { sound: CONFIG.AUDIO.defaultEnabled, vibration: CONFIG.HAPTIC.defaultEnabled },
  // Push-уведомления. См. migration[2] и pushScheduler.js.
  pushEnabled: true,
  pushPermissionAsked: false,
  // Аналитика AppMetrica. См. migration[3] и analytics.js.
  // При первой загрузке миграция 3 заполнит UUID; для свежих инсталлов
  // (без миграции) getUserId() генерирует лениво при первом обращении.
  userId: null
});

let cached = null;

// Извлекает версию сейва из payload. Если поля schemaVersion нет —
// возвращает 0 («сейв из эпохи до миграций»). Поле legacy `version` НЕ
// используется как alias — оно может быть произвольным числом из старых
// сборок; его чистит migration 1.
function readSchemaVersion(payload) {
  if (typeof payload.schemaVersion === 'number') return payload.schemaVersion;
  return 0;
}

export function load() {
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      cached = DEFAULT_STATE();
      save();
      return cached;
    }
    const parsed = JSON.parse(raw);
    const fromVersion = readSchemaVersion(parsed);
    const target = getCurrentSchemaVersion();

    if (fromVersion > target) {
      // Сейв из будущего (даунгрейд кода) — не пытаемся «угадывать», сбрасываем.
      // На практике редкий кейс (юзер откатил версию). Бэкап на всякий.
      console.warn(`[storage] save schemaVersion=${fromVersion} > code=${target}, resetting`);
      try { localStorage.setItem(`${STORAGE_KEY}_backup_future_v${fromVersion}`, raw); } catch {}
      cached = DEFAULT_STATE();
      save();
      return cached;
    }

    let state = parsed;
    if (fromVersion < target) {
      // Поднимаем через цепочку миграций.
      const result = runMigrations(parsed, fromVersion);
      state = result.state;
      state.schemaVersion = result.schemaVersion;
    }

    // Подтягиваем новые поля, появившиеся в DEFAULT_STATE (но не помеченные
    // как миграция — например, опциональные настройки с дефолтами).
    cached = { ...DEFAULT_STATE(), ...state, schemaVersion: target };
    // Удаляем legacy-поле `version` если оно осталось (сейв был на нём).
    if ('version' in cached) delete cached.version;
    save();
    return cached;
  } catch (err) {
    console.warn('[storage] failed to load, resetting:', err);
    cached = DEFAULT_STATE();
    return cached;
  }
}

export function save() {
  if (!cached) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  } catch (err) {
    console.warn('[storage] failed to save:', err);
  }
}

// === API ===

export function getState() {
  return load();
}

export function update(mutator) {
  const state = load();
  mutator(state);
  save();
  return state;
}

export function reset() {
  cached = DEFAULT_STATE();
  save();
  return cached;
}

// Удобные шорткаты для часто используемых полей.

export function getCurrentLevel() { return load().currentLevel; }
export function setCurrentLevel(idx) { update(s => { s.currentLevel = idx; }); }

/**
 * Довести стартовый запас подсказок до того, что сказал конфиг. Один раз за
 * жизнь установки, сразу после ответа сети.
 *
 * ПОЧЕМУ НЕ `hints: tuned('hints_start', ...)` В DEFAULT_STATE. Сейв рождается
 * раньше конфига: `storage.load()` — первая строка `bootstrap()`, а у загрузки
 * конфига свой таймаут в 4 секунды. Ключ, прочитанный там, вернул бы значение
 * сборки у КАЖДОГО нового игрока — то есть ровно у тех, ради кого он заведён.
 *
 * ПРИБАВЛЯЕМ РАЗНИЦУ, А НЕ ПРИСВАИВАЕМ: пока отвечает сеть, игрок уже мог
 * потратить подсказку. Присвоение вернуло бы её обратно, а при меньшем значении
 * в бакете отняло бы лишнюю. Разница верна в любой момент — конфиг говорит не
 * «столько у тебя сейчас», а «столько выдать на входе».
 *
 * Конфиг не доехал — `tuned` отдаёт значение сборки, разница нулевая, и функция
 * не делает ничего.
 */
export function applyStartGrant(startHints) {
  update((s) => {
    if (s.startAdjusted) return;
    s.startAdjusted = true;
    // Уровень уже пройден — стартовый запас своё отработал, и поправка
    // означала бы правку кошелька играющего человека.
    if (s.completedLevels.length === 0) {
      s.hints = Math.max(0, s.hints + (startHints - CONFIG.BALANCE.startingHints));
    }
  });
}

export function getHints() { return load().hints; }
export function addHints(n) { update(s => { s.hints = Math.max(0, s.hints + n); }); }
export function spendHint() { update(s => { s.hints = Math.max(0, s.hints - 1); }); }

export function markLevelCompleted(levelId) {
  update(s => {
    if (!s.completedLevels.includes(levelId)) s.completedLevels.push(levelId);
    s.stats.levelsCompleted = s.completedLevels.length;
  });
}

export function recordBonusWord(levelId, word) {
  update(s => {
    if (!s.foundBonusByLevel[levelId]) s.foundBonusByLevel[levelId] = [];
    if (!s.foundBonusByLevel[levelId].includes(word)) {
      s.foundBonusByLevel[levelId].push(word);
    }
  });
}

export function getFoundBonus(levelId) {
  return load().foundBonusByLevel[levelId] || [];
}

// === Открытые ячейки на текущем уровне ===

export function getRevealedCells(levelId) {
  const arr = load().revealedCellsByLevel[levelId];
  return Array.isArray(arr) ? arr : [];
}

export function addRevealedCell(levelId, row, col) {
  update(s => {
    if (!s.revealedCellsByLevel[levelId]) s.revealedCellsByLevel[levelId] = [];
    const list = s.revealedCellsByLevel[levelId];
    if (!list.some(c => c[0] === row && c[1] === col)) {
      list.push([row, col]);
    }
  });
}

export function clearRevealedCells(levelId) {
  update(s => { delete s.revealedCellsByLevel[levelId]; });
}

export function incWordsFound(n = 1) {
  update(s => { s.stats.wordsFound += n; });
}

export function getSettings() { return load().settings; }
export function setSetting(key, val) {
  update(s => { s.settings[key] = val; });
}

// Push-уведомления
export function getPushEnabled() { return load().pushEnabled !== false; }
export function setPushEnabled(v) { update(s => { s.pushEnabled = !!v; }); }
export function getPushPermissionAsked() { return !!load().pushPermissionAsked; }
export function setPushPermissionAsked(v) { update(s => { s.pushPermissionAsked = !!v; }); }

// AppMetrica analytics — стабильный UUID, генерируется при первом обращении
// если миграция 3 ещё не выставила его (например, fresh install без миграций).
export function getUserId() {
  const state = load();
  if (!state.userId) {
    state.userId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'u-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    save();
  }
  return state.userId;
}
