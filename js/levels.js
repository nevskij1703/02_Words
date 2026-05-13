// levels.js — ручные (курируемые) уровни 1-20.
//
// Формат:
//   { id, letters, mainWords, grid: {rows, cols}, placements }
// bonusWords автоматически вычисляются из словаря (слова из letters, не входящие в mainWords).
//
// Уровни 1-5: 3 буквы, простые палиндром-пары.
// Уровни 6-10: 4 буквы, 3 слова.
// Уровни 11-15: 5 букв, 3-4 слова.
// Уровни 16-20: 6 букв, 3-4 слова.
//
// Раскладка кроссвордов для 6-20 получена через levelGenerator.placeWords и
// проверена validateLevel — поэтому при добавлении нового уровня обязательно
// прогоните его через validateLevel() (см. devPanel.js → «Validate all»).

import { DICTIONARY, normalize } from './dictionary.js';

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

const RAW = [
  // === Уровни 1-5: 3 буквы, пары ===
  {
    id: 1, letters: ['К','О','Т'], mainWords: ['КОТ','ТОК'],
    grid: { rows: 3, cols: 3 },
    placements: [
      { word: 'КОТ', row: 1, col: 0, direction: 'horizontal' },
      { word: 'ТОК', row: 0, col: 1, direction: 'vertical' }
    ]
  },
  {
    id: 2, letters: ['С','О','Н'], mainWords: ['СОН','НОС'],
    grid: { rows: 3, cols: 3 },
    placements: [
      { word: 'СОН', row: 1, col: 0, direction: 'horizontal' },
      { word: 'НОС', row: 0, col: 1, direction: 'vertical' }
    ]
  },
  {
    id: 3, letters: ['Р','О','Т'], mainWords: ['РОТ','ТОР'],
    grid: { rows: 3, cols: 3 },
    placements: [
      { word: 'РОТ', row: 1, col: 0, direction: 'horizontal' },
      { word: 'ТОР', row: 0, col: 1, direction: 'vertical' }
    ]
  },
  {
    id: 4, letters: ['Д','О','Г'], mainWords: ['ДОГ','ГОД'],
    grid: { rows: 3, cols: 3 },
    placements: [
      { word: 'ДОГ', row: 1, col: 0, direction: 'horizontal' },
      { word: 'ГОД', row: 0, col: 1, direction: 'vertical' }
    ]
  },
  {
    id: 5, letters: ['Р','О','В'], mainWords: ['РОВ','ВОР'],
    grid: { rows: 3, cols: 3 },
    placements: [
      { word: 'РОВ', row: 1, col: 0, direction: 'horizontal' },
      { word: 'ВОР', row: 0, col: 1, direction: 'vertical' }
    ]
  },

  // === Уровни 6-10: 4 буквы ===
  {
    id: 6, letters: ['С','Л','О','Н'], mainWords: ['СЛОН','СОН','НОС'],
    grid: { rows: 3, cols: 4 },
    placements: [
      { word: 'СЛОН', row: 2, col: 0, direction: 'horizontal' },
      { word: 'СОН',  row: 0, col: 3, direction: 'vertical' },
      { word: 'НОС',  row: 0, col: 0, direction: 'vertical' }
    ]
  },
  {
    id: 7, letters: ['К','Р','О','Т'], mainWords: ['КРОТ','КОТ','РОТ'],
    grid: { rows: 4, cols: 4 },
    placements: [
      { word: 'КРОТ', row: 1, col: 0, direction: 'horizontal' },
      { word: 'КОТ',  row: 1, col: 0, direction: 'vertical' },
      { word: 'РОТ',  row: 0, col: 2, direction: 'vertical' }
    ]
  },
  {
    id: 8, letters: ['П','А','Р','К'], mainWords: ['ПАРК','КАРП','РАК'],
    grid: { rows: 5, cols: 4 },
    placements: [
      { word: 'ПАРК', row: 2, col: 0, direction: 'horizontal' },
      { word: 'КАРП', row: 1, col: 1, direction: 'vertical' },
      { word: 'РАК',  row: 0, col: 3, direction: 'vertical' }
    ]
  },
  {
    id: 9, letters: ['П','О','Р','Т'], mainWords: ['ПОРТ','ТОР','РОТ'],
    grid: { rows: 4, cols: 4 },
    placements: [
      { word: 'ПОРТ', row: 1, col: 0, direction: 'horizontal' },
      { word: 'ТОР',  row: 1, col: 3, direction: 'vertical' },
      { word: 'РОТ',  row: 0, col: 1, direction: 'vertical' }
    ]
  },
  {
    id: 10, letters: ['Т','Р','О','С'], mainWords: ['ТРОС','СОР','СТО'],
    grid: { rows: 5, cols: 4 },
    placements: [
      { word: 'ТРОС', row: 2, col: 0, direction: 'horizontal' },
      { word: 'СОР',  row: 2, col: 3, direction: 'vertical' },
      { word: 'СТО',  row: 0, col: 2, direction: 'vertical' }
    ]
  },

  // === Уровни 11-15: 5 букв ===
  {
    id: 11, letters: ['Б','О','К','А','Л'], mainWords: ['БОКАЛ','БОК','БАЛ'],
    grid: { rows: 3, cols: 5 },
    placements: [
      { word: 'БОКАЛ', row: 1, col: 0, direction: 'horizontal' },
      { word: 'БОК',   row: 0, col: 1, direction: 'vertical' },
      { word: 'БАЛ',   row: 0, col: 3, direction: 'vertical' }
    ]
  },
  {
    id: 12, letters: ['С','Т','О','Л','Б'], mainWords: ['СТОЛБ','СТОЛ','БОЛТ'],
    grid: { rows: 4, cols: 5 },
    placements: [
      { word: 'СТОЛБ', row: 3, col: 0, direction: 'horizontal' },
      { word: 'СТОЛ',  row: 0, col: 3, direction: 'vertical' },
      { word: 'БОЛТ',  row: 0, col: 1, direction: 'vertical' }
    ]
  },
  {
    id: 13, letters: ['Р','А','М','К','А'], mainWords: ['РАМКА','РАМА','РАК','МАК'],
    grid: { rows: 5, cols: 6 },
    placements: [
      { word: 'РАМКА', row: 1, col: 1, direction: 'horizontal' },
      { word: 'РАМА',  row: 1, col: 1, direction: 'vertical' },
      { word: 'РАК',   row: 4, col: 0, direction: 'horizontal' },
      { word: 'МАК',   row: 0, col: 5, direction: 'vertical' }
    ]
  },
  {
    id: 14, letters: ['С','О','К','О','Л'], mainWords: ['СОКОЛ','СОК','КОЛ'],
    grid: { rows: 3, cols: 5 },
    placements: [
      { word: 'СОКОЛ', row: 1, col: 0, direction: 'horizontal' },
      { word: 'СОК',   row: 0, col: 3, direction: 'vertical' },
      { word: 'КОЛ',   row: 0, col: 1, direction: 'vertical' }
    ]
  },
  {
    id: 15, letters: ['Б','А','Р','А','Н'], mainWords: ['БАРАН','БАР','РАНА'],
    grid: { rows: 6, cols: 5 },
    placements: [
      { word: 'БАРАН', row: 3, col: 0, direction: 'horizontal' },
      { word: 'РАНА',  row: 0, col: 1, direction: 'vertical' },
      { word: 'БАР',   row: 3, col: 0, direction: 'vertical' }
    ]
  },

  // === Уровни 16-20: 6 букв ===
  {
    id: 16, letters: ['К','А','Р','Т','О','Н'], mainWords: ['КАРТОН','КОРА','РОТА','ТОН'],
    grid: { rows: 7, cols: 6 },
    placements: [
      { word: 'КАРТОН', row: 3, col: 0, direction: 'horizontal' },
      { word: 'КОРА',   row: 0, col: 1, direction: 'vertical' },
      { word: 'РОТА',   row: 3, col: 2, direction: 'vertical' },
      { word: 'ТОН',    row: 1, col: 0, direction: 'horizontal' }
    ]
  },
  {
    id: 17, letters: ['М','А','Ш','И','Н','А'], mainWords: ['МАШИНА','ШИНА','МИНА'],
    grid: { rows: 7, cols: 6 },
    placements: [
      { word: 'МАШИНА', row: 3, col: 0, direction: 'horizontal' },
      { word: 'ШИНА',   row: 0, col: 5, direction: 'vertical' },
      { word: 'МИНА',   row: 3, col: 0, direction: 'vertical' }
    ]
  },
  {
    id: 18, letters: ['С','О','Б','А','К','А'], mainWords: ['СОБАКА','КОСА','БАС','ОСА'],
    grid: { rows: 6, cols: 6 },
    placements: [
      { word: 'СОБАКА', row: 2, col: 0, direction: 'horizontal' },
      { word: 'КОСА',   row: 2, col: 4, direction: 'vertical' },
      { word: 'БАС',    row: 0, col: 0, direction: 'vertical' },
      { word: 'ОСА',    row: 4, col: 3, direction: 'horizontal' }
    ]
  },
  {
    id: 19, letters: ['С','Т','Р','А','Н','А'], mainWords: ['СТРАНА','РАНА','СТАН'],
    grid: { rows: 5, cols: 6 },
    placements: [
      { word: 'СТРАНА', row: 2, col: 0, direction: 'horizontal' },
      { word: 'РАНА',   row: 0, col: 4, direction: 'vertical' },
      { word: 'СТАН',   row: 1, col: 1, direction: 'vertical' }
    ]
  },
  {
    id: 20, letters: ['П','О','Д','В','А','Л'], mainWords: ['ПОДВАЛ','ВОДА','ВАЛ','ДВА'],
    grid: { rows: 6, cols: 6 },
    placements: [
      { word: 'ПОДВАЛ', row: 3, col: 0, direction: 'horizontal' },
      { word: 'ВОДА',   row: 0, col: 4, direction: 'vertical' },
      { word: 'ВАЛ',    row: 3, col: 3, direction: 'vertical' },
      { word: 'ДВА',    row: 0, col: 3, direction: 'horizontal' }
    ]
  }
];

export const HAND_CRAFTED_LEVELS = RAW.map(populateBonus);
