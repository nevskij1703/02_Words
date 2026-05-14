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
  // Отключаем предыдущий ResizeObserver, если был.
  if (container.__crosswordRO) {
    container.__crosswordRO.disconnect();
    container.__crosswordRO = null;
  }
  container.innerHTML = '';
  const { rows, cols } = level.grid;
  const cells = buildCellMap(level.placements, rows, cols);

  // CSS Grid с фиксированным числом колонок. Реальный размер ячейки
  // считаем в fit() из доступного места — без этого сетка с 10-11 строками
  // вылазит за вертикальные пределы (top-cut на узком экране).
  const grid = document.createElement('div');
  grid.className = 'crossword-grid';
  grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;

  const MAX_CELL = 52;
  const MIN_CELL = 16;
  const GAP_PX = 3;
  const PAD_PX = 16;   // .crossword-wrap padding (8 × 2)

  function fit() {
    const rect = container.getBoundingClientRect();
    const availW = Math.max(0, rect.width  - PAD_PX);
    const availH = Math.max(0, rect.height - PAD_PX);
    if (availW < 10 || availH < 10) return;
    const cellByW = (availW - (cols - 1) * GAP_PX) / cols;
    const cellByH = (availH - (rows - 1) * GAP_PX) / rows;
    const cell = Math.max(MIN_CELL, Math.min(MAX_CELL, cellByW, cellByH));
    const totalW = cell * cols + (cols - 1) * GAP_PX;
    grid.style.width = totalW + 'px';
    grid.style.maxWidth = totalW + 'px';
    // Размер шрифта подгоняем под фактический размер ячейки.
    const fontPx = Math.max(10, Math.min(22, Math.round(cell * 0.55)));
    grid.style.setProperty('--cell-font', fontPx + 'px');
  }

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

  // Подгоняем размер ячеек под доступное место и следим за ресайзом.
  fit();
  requestAnimationFrame(fit);
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(fit);
    ro.observe(container);
    container.__crosswordRO = ro;
  } else {
    window.addEventListener('resize', fit);
  }

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
