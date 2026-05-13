// levelGenerator.js — генератор и валидатор уровней.
//
// Публичное API:
//   generateLevel({ letterCount, minWords, maxWords, minWordLen, maxWordLen, difficulty })
//     → level | null
//   placeWords(words) → { rows, cols, placements } | null   (низкоуровнево)
//   validateLevel(level) → { ok: boolean, errors: string[] }
//
// Алгоритм размещения:
//   1. Самое длинное слово — горизонтально в центре.
//   2. Для каждого следующего слова ищем пересечение по общей букве
//      с уже размещёнными. Проверяем, что:
//        - Перпендикулярная ось (только в местах не-пересечения) пустая.
//        - Размещение не создаёт «соседние параллельные касания» без креста.
//        - Пересечение в общей букве совпадает.
//   3. Не получилось разместить ≥ minPlacements слов → возвращаем null,
//      генератор перебирает другой набор слов/букв.

import { DICTIONARY, WORDS_BY_LENGTH, normalize } from './dictionary.js';
import { canFormWord } from './levels.js';
import { CONFIG } from './config.js';

const VOWELS = new Set('АЕИОУЫЭЮЯ'.split(''));
// Частотность букв в русском (упрощённо). Используем для взвешенного выбора.
const LETTER_FREQ = {
  О: 11, А: 8, Е: 8, И: 7, Н: 7, Т: 6, Р: 5, С: 5, Л: 4, К: 4,
  В: 4, М: 3, П: 3, У: 3, Я: 2, Д: 3, Ы: 2, Ь: 2, Г: 2, З: 2,
  Б: 2, Ч: 2, Й: 1, Ж: 1, Х: 1, Ш: 1, Ю: 1, Ц: 1, Щ: 1, Э: 1, Ф: 1
};

function weightedPick(weights) {
  const total = weights.reduce((s, w) => s + w[1], 0);
  let r = Math.random() * total;
  for (const [v, w] of weights) {
    r -= w;
    if (r <= 0) return v;
  }
  return weights[weights.length - 1][0];
}

function pickLetters(n) {
  const weights = Object.entries(LETTER_FREQ);
  const out = [];
  let vowelCount = 0;
  while (out.length < n) {
    const ch = weightedPick(weights);
    out.push(ch);
    if (VOWELS.has(ch)) vowelCount++;
  }
  // Гарантируем ≥2 гласных, иначе пересоберём.
  if (vowelCount < 2) {
    const vowels = ['О','А','Е','И'];
    for (let i = 0; i < out.length && vowelCount < 2; i++) {
      if (!VOWELS.has(out[i])) {
        out[i] = vowels[Math.floor(Math.random() * vowels.length)];
        vowelCount++;
      }
    }
  }
  return out;
}

// Все слова из словаря, составимые из мультимножества letters.
export function findFormableWords(letters, minLen = 3, maxLen = 7) {
  const letterPool = letters.map(normalize);
  const result = [];
  for (let len = minLen; len <= maxLen; len++) {
    const bucket = WORDS_BY_LENGTH[len] || [];
    for (const w of bucket) {
      if (canFormWord(w, letterPool)) result.push(w);
    }
  }
  return result;
}

// === Размещение ===

function emptyGrid(rows, cols) {
  return Array.from({ length: rows }, () => Array(cols).fill(null));
}

function copyGrid(g) {
  return g.map(row => row.slice());
}

// Можно ли поместить слово word в grid начиная с (r,c) направления dir?
// Правила (стандартные для кроссворда):
//   - Координаты в границах.
//   - В каждой ячейке либо null, либо буква совпадает.
//   - Хотя бы в одной ячейке уже что-то есть (пересечение) — для слов кроме первого.
//   - Соседние клетки до начала и после конца слова должны быть пусты.
//   - Для каждой буквы слова, которая ПОПАДАЕТ В НОВУЮ (пустую) клетку,
//     соседние клетки по перпендикулярной оси должны быть пустыми (запрет
//     «параллельных касаний» — стандартный crossword rule).
function canPlace(grid, word, r, c, dir, requireIntersect) {
  const rows = grid.length;
  const cols = grid[0].length;
  let intersected = false;

  for (let i = 0; i < word.length; i++) {
    const rr = dir === 'horizontal' ? r : r + i;
    const cc = dir === 'horizontal' ? c + i : c;
    if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) return false;
    const cell = grid[rr][cc];
    if (cell !== null) {
      if (cell !== word[i]) return false;
      intersected = true;
    } else {
      // Перпендикулярные соседи новой ячейки должны быть пустыми.
      const pr = dir === 'horizontal' ? [rr - 1, cc] : [rr, cc - 1];
      const nx = dir === 'horizontal' ? [rr + 1, cc] : [rr, cc + 1];
      for (const [yr, yc] of [pr, nx]) {
        if (yr >= 0 && yr < rows && yc >= 0 && yc < cols && grid[yr][yc] !== null) return false;
      }
    }
  }

  // До начала и после конца слова — соседи должны быть пусты.
  const beforeR = dir === 'horizontal' ? r : r - 1;
  const beforeC = dir === 'horizontal' ? c - 1 : c;
  if (beforeR >= 0 && beforeC >= 0 && beforeR < rows && beforeC < cols && grid[beforeR][beforeC] !== null) return false;

  const afterR = dir === 'horizontal' ? r : r + word.length;
  const afterC = dir === 'horizontal' ? c + word.length : c;
  if (afterR >= 0 && afterC >= 0 && afterR < rows && afterC < cols && grid[afterR][afterC] !== null) return false;

  if (requireIntersect && !intersected) return false;
  return true;
}

function placeOnGrid(grid, word, r, c, dir) {
  for (let i = 0; i < word.length; i++) {
    const rr = dir === 'horizontal' ? r : r + i;
    const cc = dir === 'horizontal' ? c + i : c;
    grid[rr][cc] = word[i];
  }
}

// Найти все возможные позиции для слова, чтобы оно пересекало уже что-то на сетке.
function findPlacements(grid, word) {
  const rows = grid.length;
  const cols = grid[0].length;
  const out = [];
  for (let i = 0; i < word.length; i++) {
    // Идём по сетке, ищем cell == word[i]; пробуем разместить так,
    // чтобы word[i] попало на эту cell в обе ориентации.
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] !== word[i]) continue;
        // Horizontal: слово начинается в (r, c - i).
        if (canPlace(grid, word, r, c - i, 'horizontal', true)) {
          out.push({ row: r, col: c - i, direction: 'horizontal' });
        }
        // Vertical: слово начинается в (r - i, c).
        if (canPlace(grid, word, r - i, c, 'vertical', true)) {
          out.push({ row: r - i, col: c, direction: 'vertical' });
        }
      }
    }
  }
  return out;
}

// Скомпактовать сетку: убрать пустые строки/столбцы по краям, сдвинуть placements.
function compact(grid, placements) {
  const rows = grid.length, cols = grid[0].length;
  let top = rows, bottom = -1, left = cols, right = -1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] !== null) {
        if (r < top) top = r;
        if (r > bottom) bottom = r;
        if (c < left) left = c;
        if (c > right) right = c;
      }
    }
  }
  if (bottom < 0) return { rows: 0, cols: 0, placements: [] };
  const newRows = bottom - top + 1;
  const newCols = right - left + 1;
  const newPlacements = placements.map(p => ({
    word: p.word,
    row: p.row - top,
    col: p.col - left,
    direction: p.direction
  }));
  return { rows: newRows, cols: newCols, placements: newPlacements };
}

// Главная функция размещения. На входе — массив слов (нормализованных).
// Сортируем по убыванию длины, кладём первое в центр, дальше — где пересекается.
export function placeWords(rawWords) {
  const words = [...new Set(rawWords.map(normalize))].filter(w => w.length >= 3);
  if (words.length === 0) return null;
  words.sort((a, b) => b.length - a.length);

  // Большая «холщовая» сетка; потом скомпактуем.
  const MAX = 20;
  const grid = emptyGrid(MAX, MAX);
  const placements = [];

  // Первое слово — горизонтально по центру.
  const first = words[0];
  const r0 = Math.floor(MAX / 2);
  const c0 = Math.floor((MAX - first.length) / 2);
  if (!canPlace(grid, first, r0, c0, 'horizontal', false)) return null;
  placeOnGrid(grid, first, r0, c0, 'horizontal');
  placements.push({ word: first, row: r0, col: c0, direction: 'horizontal' });

  // Остальные.
  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const opts = findPlacements(grid, word);
    if (opts.length === 0) continue;            // пропускаем — пересечения нет
    // Выбираем случайный из вариантов.
    const opt = opts[Math.floor(Math.random() * opts.length)];
    placeOnGrid(grid, word, opt.row, opt.col, opt.direction);
    placements.push({ word, row: opt.row, col: opt.col, direction: opt.direction });
  }

  return compact(grid, placements);
}

// === Валидация уровня ===

export function validateLevel(level) {
  const errors = [];
  if (!level || !Array.isArray(level.letters) || !Array.isArray(level.mainWords) || !Array.isArray(level.placements) || !level.grid) {
    errors.push('малформенный уровень: нет одного из обязательных полей');
    return { ok: false, errors };
  }
  const lettersNorm = level.letters.map(normalize);
  const main = level.mainWords.map(normalize);
  // (a) Все mainWords составимы из letters.
  for (const w of main) {
    if (!canFormWord(w, lettersNorm)) errors.push(`'${w}' нельзя составить из букв ${lettersNorm.join('')}`);
  }
  // (b) Каждое placement.word ∈ mainWords.
  const mainSet = new Set(main);
  for (const p of level.placements) {
    if (!mainSet.has(normalize(p.word))) errors.push(`placement '${p.word}' не из mainWords`);
  }
  // (c) Каждое mainWord размещено.
  const placedSet = new Set(level.placements.map(p => normalize(p.word)));
  for (const w of main) {
    if (!placedSet.has(w)) errors.push(`'${w}' отсутствует в placements`);
  }
  // (d) Сетка валидна (нет конфликтов, нет ghost-слов).
  try {
    const rows = level.grid.rows, cols = level.grid.cols;
    const cells = emptyGrid(rows, cols);
    for (let i = 0; i < level.placements.length; i++) {
      const p = level.placements[i];
      const word = normalize(p.word);
      for (let k = 0; k < word.length; k++) {
        const r = p.direction === 'horizontal' ? p.row : p.row + k;
        const c = p.direction === 'horizontal' ? p.col + k : p.col;
        if (r < 0 || r >= rows || c < 0 || c >= cols) {
          errors.push(`'${word}' выходит за пределы в [${r},${c}]`); break;
        }
        if (cells[r][c] !== null && cells[r][c] !== word[k]) {
          errors.push(`конфликт в [${r},${c}]: '${cells[r][c]}' vs '${word[k]}' ('${word}')`); break;
        }
        cells[r][c] = word[k];
      }
    }
    // Ghost: для каждой строки и столбца — последовательность подряд непустых ячеек
    // должна быть либо placement-словом, либо состоять из одной буквы.
    function checkLine(getCell, length) {
      let cur = '';
      for (let i = 0; i <= length; i++) {
        const ch = i < length ? getCell(i) : null;
        if (ch !== null) {
          cur += ch;
        } else {
          if (cur.length >= 2) {
            // Сегмент длиной ≥2: должен быть среди placement-слов.
            const found = level.placements.some(p => normalize(p.word) === cur);
            if (!found) {
              // Если сегмент сам по себе слово из словаря — это ghost word.
              if (DICTIONARY.has(cur)) errors.push(`ghost word '${cur}' образуется на сетке`);
              // Если не слово — это просто «прилипшие» буквы; тоже плохо как кроссворд,
              // но менее критично. Тоже считаем ошибкой структуры.
              else errors.push(`лишняя последовательность '${cur}' не входит в placements`);
            }
          }
          cur = '';
        }
      }
    }
    for (let r = 0; r < rows; r++) checkLine(i => cells[r][i], cols);
    for (let c = 0; c < cols; c++) checkLine(i => cells[i][c], rows);
  } catch (e) {
    errors.push(`исключение при валидации сетки: ${e.message}`);
  }
  return { ok: errors.length === 0, errors };
}

// === Полная генерация уровня ===

export function generateLevel(opts = {}) {
  const o = { ...CONFIG.GENERATOR_DEFAULTS, ...opts };
  const reshuffles = o.maxLetterReshuffles;
  for (let attempt = 0; attempt < reshuffles; attempt++) {
    const letters = pickLetters(o.letterCount);
    const formable = findFormableWords(letters, o.minWordLen, o.maxWordLen);
    if (formable.length < o.minWords) continue;

    // Выбираем основные слова: предпочитаем покрытие разными буквами.
    // Простой эвристик: shuffle + берём minWords..maxWords.
    formable.sort(() => Math.random() - 0.5);
    const numWords = Math.min(o.maxWords, Math.max(o.minWords, Math.floor(o.minWords + Math.random() * (o.maxWords - o.minWords + 1))));
    const main = formable.slice(0, numWords);

    // Размещаем.
    const layout = placeWords(main);
    if (!layout) continue;
    // Все основные ли разместились?
    const placedWords = new Set(layout.placements.map(p => p.word));
    const placedMain = main.filter(w => placedWords.has(w));
    if (placedMain.length < o.minWords) continue;

    // Если разместились не все запрошенные слова — берём только размещённые как mainWords.
    const finalMain = placedMain;

    // Бонусы — всё что формируется, но не в основных.
    const bonus = formable.filter(w => !finalMain.includes(w));

    const level = {
      id: opts.id ?? Date.now(),
      letters,
      mainWords: finalMain,
      bonusWords: bonus,
      grid: { rows: layout.rows, cols: layout.cols },
      placements: layout.placements
    };
    const v = validateLevel(level);
    if (v.ok) return level;
    // Если валидация не прошла — пробуем дальше.
  }
  return null;
}
