// levels.js — ручные уровни. На этом этапе 5 штук для теста MVP,
// расширим до 20 после проверки игрового цикла.
//
// Формат уровня:
//   { id, letters, mainWords, grid: {rows, cols}, placements }
// bonusWords добавляются программно (см. populateBonus ниже) — слова из
// словаря, составимые из letters, исключая mainWords.

import { DICTIONARY, normalize } from './dictionary.js';

// Можно ли составить слово word из мультимножества букв letters?
export function canFormWord(word, letters) {
  const pool = new Map();
  for (const ch of letters) pool.set(ch, (pool.get(ch) || 0) + 1);
  for (const ch of word) {
    const cnt = pool.get(ch) || 0;
    if (cnt === 0) return false;
    pool.set(ch, cnt - 1);
  }
  return true;
}

function populateBonus(level) {
  const lettersNorm = level.letters.map(normalize);
  const main = new Set(level.mainWords.map(normalize));
  const bonus = [];
  for (const w of DICTIONARY) {
    if (w.length < 3) continue;
    if (main.has(w)) continue;
    if (canFormWord(w, lettersNorm)) bonus.push(w);
  }
  return { ...level, bonusWords: bonus };
}

// === Сырые уровни ===

const RAW = [
  {
    id: 1,
    letters: ['К','О','Т'],
    mainWords: ['КОТ','ТОК'],
    grid: { rows: 3, cols: 3 },
    placements: [
      { word: 'КОТ', row: 1, col: 0, direction: 'horizontal' },
      { word: 'ТОК', row: 0, col: 1, direction: 'vertical' }
    ]
  },
  {
    id: 2,
    letters: ['С','О','Н'],
    mainWords: ['СОН','НОС'],
    grid: { rows: 3, cols: 3 },
    placements: [
      { word: 'СОН', row: 1, col: 0, direction: 'horizontal' },
      { word: 'НОС', row: 0, col: 1, direction: 'vertical' }
    ]
  },
  {
    id: 3,
    letters: ['Р','О','Т'],
    mainWords: ['РОТ','ТОР'],
    grid: { rows: 3, cols: 3 },
    placements: [
      { word: 'РОТ', row: 1, col: 0, direction: 'horizontal' },
      { word: 'ТОР', row: 0, col: 1, direction: 'vertical' }
    ]
  },
  {
    id: 4,
    letters: ['Д','О','Г'],
    mainWords: ['ДОГ','ГОД'],
    grid: { rows: 3, cols: 3 },
    placements: [
      { word: 'ДОГ', row: 1, col: 0, direction: 'horizontal' },
      { word: 'ГОД', row: 0, col: 1, direction: 'vertical' }
    ]
  },
  {
    id: 5,
    letters: ['Р','О','В'],
    mainWords: ['РОВ','ВОР'],
    grid: { rows: 3, cols: 3 },
    placements: [
      { word: 'РОВ', row: 1, col: 0, direction: 'horizontal' },
      { word: 'ВОР', row: 0, col: 1, direction: 'vertical' }
    ]
  }
];

export const HAND_CRAFTED_LEVELS = RAW.map(populateBonus);
