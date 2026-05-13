// storage.js — обёртка над localStorage с версионированием схемы.
// При несовпадении версии — бэкап старого ключа и чистая инициализация.

import { CONFIG } from './config.js';

const STORAGE_KEY = '02words_save';
const SCHEMA_VERSION = 1;

const DEFAULT_STATE = () => ({
  version: SCHEMA_VERSION,
  currentLevel: 0,
  completedLevels: [],         // [levelId, ...]
  hints: CONFIG.BALANCE.startingHints,
  foundBonusByLevel: {},       // { [levelId]: ['СЛОВО', ...] }
  stats: { levelsCompleted: 0, wordsFound: 0 },
  settings: { sound: CONFIG.AUDIO.defaultEnabled, vibration: CONFIG.HAPTIC.defaultEnabled }
});

let cached = null;

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
    if (parsed.version !== SCHEMA_VERSION) {
      // Бэкап старой версии (на всякий случай) и сброс.
      try {
        localStorage.setItem(`02words_backup_v${parsed.version || 'unknown'}`, raw);
      } catch { /* нет места — окей */ }
      cached = DEFAULT_STATE();
      save();
      return cached;
    }
    // Заполняем поля, появившиеся в новых версиях патча (но не схемы).
    cached = { ...DEFAULT_STATE(), ...parsed };
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

export function incWordsFound(n = 1) {
  update(s => { s.stats.wordsFound += n; });
}

export function getSettings() { return load().settings; }
export function setSetting(key, val) {
  update(s => { s.settings[key] = val; });
}
