// storage.js — обёртка над localStorage с системой миграций сейва.
// См. docs/SAVES.md (контракт) и js/migrations.js (реестр миграций).

import { CONFIG } from './config.js';
import { runMigrations, getCurrentSchemaVersion } from './migrations.js';

const STORAGE_KEY = '02words_save';

const DEFAULT_STATE = () => ({
  schemaVersion: getCurrentSchemaVersion(),
  currentLevel: 0,
  completedLevels: [],          // [levelId, ...]
  hints: CONFIG.BALANCE.startingHints,
  foundBonusByLevel: {},        // { [levelId]: ['СЛОВО', ...] }
  revealedCellsByLevel: {},     // { [levelId]: [[row, col], ...] }
  stats: { levelsCompleted: 0, wordsFound: 0 },
  settings: { sound: CONFIG.AUDIO.defaultEnabled, vibration: CONFIG.HAPTIC.defaultEnabled }
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
