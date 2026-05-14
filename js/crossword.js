// crossword.js — сборка карты ячеек из placements + рендер CSS-grid + анимации.
//
// Внешняя модель: level.placements = [{ word, row, col, direction }, ...]
// Внутренняя модель: cells[row][col] = null | { letter, revealed, placements: number[] }

import { normalize } from './dictionary.js';

// Построить карту ячеек по списку размещений.
// Если в одной клетке требуются разные буквы — это невалидное размещение,
// функция бросит ошибку (на нашем validateLevel поймаем заранее).
export function buildCellMap(placements, rows, cols) {
  const cells = Array.from({ length: rows }, () => Array(cols).fill(null));
  placements.forEach((p, idx) => {
    const word = normalize(p.word);
    for (let i = 0; i < word.length; i++) {
      const r = p.direction === 'horizontal' ? p.row : p.row + i;
      const c = p.direction === 'horizontal' ? p.col + i : p.col;
      if (r < 0 || r >= rows || c < 0 || c >= cols) {
        throw new Error(`placement ${idx} (${p.word}) out of bounds at [${r},${c}]`);
      }
      const existing = cells[r][c];
      if (existing && existing.letter !== word[i]) {
        throw new Error(
          `placement ${idx} (${p.word}) conflicts with existing letter ` +
          `'${existing.letter}' at [${r},${c}] (wants '${word[i]}')`
        );
      }
      if (existing) {
        existing.placements.push(idx);
      } else {
        cells[r][c] = { letter: word[i], revealed: false, placements: [idx] };
      }
    }
  });
  return cells;
}

// Рендер сетки в указанный контейнер. Возвращает API для управления.
export function render(level, container) {
  container.innerHTML = '';
  const { rows, cols } = level.grid;
  const cells = buildCellMap(level.placements, rows, cols);

  // CSS Grid с фиксированным числом колонок. Размер ячейки — auto, ограничим max.
  const grid = document.createElement('div');
  grid.className = 'crossword-grid';
  grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;

  // Ширину ограничиваем меньшим из (доступная ширина, cols × maxCellPx).
  // Для плотных кроссвордов (11×11) на 350px-телефоне ячейка будет ~30px.
  const maxCellPx = cols >= 9 ? 40 : 52;
  grid.style.maxWidth = `${cols * maxCellPx}px`;
  grid.style.width = '100%';

  // Создаём DOM-ячейки и держим ссылки.
  const cellEls = Array.from({ length: rows }, () => Array(cols).fill(null));

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cellData = cells[r][c];
      const el = document.createElement('div');
      if (!cellData) {
        el.className = 'cell empty';
      } else {
        el.className = 'cell letter';
        el.dataset.revealed = 'false';
        el.dataset.row = String(r);
        el.dataset.col = String(c);
        const face = document.createElement('span');
        face.className = 'letter-face';
        face.textContent = cellData.letter;
        el.appendChild(face);
      }
      grid.appendChild(el);
      cellEls[r][c] = el;
    }
  }

  container.appendChild(grid);

  // === API возврата ===

  function revealCell(r, c, delayMs = 0) {
    const data = cells[r][c];
    const el = cellEls[r][c];
    if (!data || data.revealed) return false;
    const apply = () => {
      data.revealed = true;
      el.dataset.revealed = 'true';
      el.classList.add('flip');
      el.addEventListener('animationend', () => el.classList.remove('flip'), { once: true });
    };
    // Для delayMs=0 — синхронно, чтобы isAllRevealed() сразу видел изменение.
    if (delayMs > 0) setTimeout(apply, delayMs);
    else apply();
    return true;
  }

  // Раскрыть все ячейки слова с лёгкой задержкой между ними (волной).
  function revealPlacement(placementIdx) {
    const p = level.placements[placementIdx];
    const word = normalize(p.word);
    const newlyRevealed = [];
    for (let i = 0; i < word.length; i++) {
      const r = p.direction === 'horizontal' ? p.row : p.row + i;
      const c = p.direction === 'horizontal' ? p.col + i : p.col;
      const data = cells[r][c];
      if (data && !data.revealed) {
        revealCell(r, c, i * 80);
        newlyRevealed.push([r, c]);
      }
    }
    return newlyRevealed;
  }

  // Случайная неоткрытая буква (для подсказки).
  function revealRandomHiddenCell() {
    const hidden = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (cells[r][c] && !cells[r][c].revealed) hidden.push([r, c]);
      }
    }
    if (!hidden.length) return null;
    const [r, c] = hidden[Math.floor(Math.random() * hidden.length)];
    revealCell(r, c);
    return [r, c];
  }

  function isAllRevealed() {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (cells[r][c] && !cells[r][c].revealed) return false;
      }
    }
    return true;
  }

  // Найти индекс placement по нормализованному слову (если оно ещё не раскрыто).
  function findPlacementByWord(word) {
    const norm = normalize(word);
    for (let i = 0; i < level.placements.length; i++) {
      if (normalize(level.placements[i].word) === norm) return i;
    }
    return -1;
  }

  return {
    revealCell,
    revealPlacement,
    revealRandomHiddenCell,
    isAllRevealed,
    findPlacementByWord,
    getCells: () => cells
  };
}
