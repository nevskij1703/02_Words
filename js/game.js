// game.js — оркестратор игрового цикла.
//
// API:
//   const game = createGame({ onEvent });
//   game.loadLevel(level);
//   game.submitWord(word);   // вернёт { kind: 'main'|'bonus'|'already'|'invalid', placementIdx? }
//   game.useHint();          // вернёт boolean (удалось)
//   game.isLevelComplete();
//   game.getFoundMain() / getFoundBonus() / getHints()
//
// События (через onEvent({ type, ...payload })):
//   { type: 'word-main',  word, placementIdx }
//   { type: 'word-bonus', word }
//   { type: 'word-already', word }
//   { type: 'word-invalid', word }
//   { type: 'hint',  cell: [r,c], hintsLeft }
//   { type: 'hint-empty' }     // подсказки кончились
//   { type: 'level-complete' }

import { DICTIONARY, normalize } from './dictionary.js';
import { canFormWord } from './levels.js';
import * as storage from './storage.js';
import * as cells from './cells.js';
import { CONFIG } from './config.js';

export function createGame({ onEvent = () => {}, crossword = null } = {}) {
  let level = null;
  let foundMain = new Set();
  let foundBonus = new Set();
  let bonusSet = new Set();
  let mainSet = new Set();
  let wrongStreak = 0;
  let hintBannerVisible = false;
  let levelCompleteEmitted = false;

  function noteWrong() {
    wrongStreak++;
    if (!hintBannerVisible && wrongStreak >= CONFIG.BALANCE.wrongStreakForHintBanner) {
      hintBannerVisible = true;
      onEvent({ type: 'show-hint-banner' });
    }
  }

  function noteValid() {
    wrongStreak = 0;
    if (hintBannerVisible) {
      hintBannerVisible = false;
      onEvent({ type: 'hide-hint-banner' });
    }
  }

  let cw = crossword;

  function loadLevel(lv) {
    level = lv;
    foundMain = new Set();
    foundBonus = new Set();
    mainSet  = new Set(lv.mainWords.map(normalize));
    bonusSet = new Set((lv.bonusWords || []).map(normalize));
    wrongStreak = 0;
    hintBannerVisible = false;
    levelCompleteEmitted = false;

    // Учитываем уже найденные ранее бонусы из storage (по идее их игрок
    // нашёл при предыдущем заходе на уровень).
    const saved = storage.getFoundBonus(lv.id);
    for (const w of saved) foundBonus.add(normalize(w));

    // Восстанавливаем ранее открытые ячейки (свайпом или подсказкой).
    // restoreCell не дёргает onCellReveal — в cells.js не пишется заново.
    if (cw && typeof cw.restoreCell === 'function') {
      const savedCells = cells.getCells(lv.id);
      for (const [r, c] of savedCells) cw.restoreCell(r, c);
      // После восстановления — авто-зачёт слов, у которых все ячейки открыты.
      checkAndMarkRevealedWords();
    }
  }

  // Идемпотентная эмиссия level-complete (один раз за уровень).
  function emitLevelComplete() {
    if (levelCompleteEmitted) return;
    levelCompleteEmitted = true;
    storage.markLevelCompleted(level.id);
    // Состояние ячеек уровня больше не нужно — освобождаем место и
    // гарантируем чистый старт при повторном заходе.
    cells.clearCells(level.id);
    onEvent({ type: 'level-complete' });
  }

  // Проверяет все ненайденные main-слова: если все их ячейки открыты —
  // авто-зачитывает. Вызывается после каждого открытия ячеек (подсказка,
  // успешный свайп, чит-скип). Закрывает баг с «перекрестьем».
  function checkAndMarkRevealedWords() {
    if (!level || !cw) return;
    const cells = cw.getCells();
    for (let i = 0; i < level.placements.length; i++) {
      const p = level.placements[i];
      const word = normalize(p.word);
      if (foundMain.has(word)) continue;
      if (!mainSet.has(word)) continue;
      let allRevealed = true;
      for (let k = 0; k < word.length; k++) {
        const r = p.direction === 'horizontal' ? p.row : p.row + k;
        const c = p.direction === 'horizontal' ? p.col + k : p.col;
        const cell = cells[r] && cells[r][c];
        if (!cell || !cell.revealed) { allRevealed = false; break; }
      }
      if (!allRevealed) continue;
      foundMain.add(word);
      storage.incWordsFound(1);
      onEvent({ type: 'word-main', word, placementIdx: i, auto: true });
    }
    if (isLevelComplete()) emitLevelComplete();
  }

  // Ячейки конкретного placement-а (для проверки пересечений).
  function placementCells(p) {
    const word = normalize(p.word);
    const out = [];
    for (let i = 0; i < word.length; i++) {
      const r = p.direction === 'horizontal' ? p.row : p.row + i;
      const c = p.direction === 'horizontal' ? p.col + i : p.col;
      out.push([r, c]);
    }
    return out;
  }
  function placementsIntersect(p1, p2) {
    const a = placementCells(p1);
    const b = placementCells(p2);
    for (const [r1, c1] of a) {
      for (const [r2, c2] of b) {
        if (r1 === r2 && c1 === c2) return true;
      }
    }
    return false;
  }

  // Возвращает true, если введённое короткое main-слово w является substring
  // какого-то ещё не открытого main-слова И их placements пересекаются по
  // ячейкам сетки. Тогда мы НЕ зачитываем w: иначе раскрытие placement-а w
  // раскроет несколько ячеек длинного слова, и игрок воспринимает это как
  // «частичное открытие». Пример — уровень 14: ПАР ⊂ ПАРА ⊂ ПАРАД, все три
  // placements пересекаются. Свайп «ПАР» раньше открывал 3 буквы внутри ПАРА
  // и одну букву ПАРАД, что выглядело как баг.
  //
  // Substring-пары БЕЗ пересечения placements (например, РАМА ⊂ ДРАМА на том
  // же уровне 14, где РАМА вертикально в столбце 5, а ДРАМА горизонтально в
  // строке 4) — НЕ блокируются, потому что раскрытие РАМА не задевает ячейки
  // ДРАМА.
  function blocksAsSubstringOfUnrevealed(w) {
    if (!level) return false;
    const placeShort = level.placements.find(p => normalize(p.word) === w);
    if (!placeShort) return false;
    for (const longer of mainSet) {
      if (longer === w) continue;
      if (longer.length <= w.length) continue;
      if (foundMain.has(longer)) continue;
      if (!longer.includes(w)) continue;
      const placeLong = level.placements.find(p => normalize(p.word) === longer);
      if (placeLong && placementsIntersect(placeShort, placeLong)) return true;
    }
    return false;
  }

  function submitWord(word) {
    const w = normalize(word);
    if (!level || w.length < 3) {
      onEvent({ type: 'word-invalid', word: w });
      noteWrong();
      return { kind: 'invalid' };
    }
    if (!canFormWord(w, level.letters.map(normalize))) {
      onEvent({ type: 'word-invalid', word: w });
      noteWrong();
      return { kind: 'invalid' };
    }
    // Main?
    if (mainSet.has(w)) {
      if (foundMain.has(w)) {
        onEvent({ type: 'word-already', word: w });
        return { kind: 'already' };
      }
      // Защита от «частичного открытия» длинного слова через его substring:
      // см. blocksAsSubstringOfUnrevealed выше. Откатываем как invalid —
      // игрок получает шейк/звук ошибки, счётчик ошибок продолжает расти.
      if (blocksAsSubstringOfUnrevealed(w)) {
        onEvent({ type: 'word-invalid', word: w });
        noteWrong();
        return { kind: 'invalid' };
      }
      foundMain.add(w);
      storage.incWordsFound(1);
      noteValid();
      const placementIdx = level.placements.findIndex(p => normalize(p.word) === w);
      if (cw && placementIdx >= 0) cw.revealPlacement(placementIdx);
      onEvent({ type: 'word-main', word: w, placementIdx });
      // Эмиссия level-complete по списку слов (быстрый путь — последнее слово
      // игрок набрал сам).
      if (isLevelComplete()) emitLevelComplete();
      // После анимации раскрытия placement-а проверяем, не открылись ли
      // другие слова через общие буквы.
      setTimeout(() => checkAndMarkRevealedWords(), w.length * 80 + 80);
      return { kind: 'main', placementIdx };
    }
    // Bonus?
    if (bonusSet.has(w)) {
      if (foundBonus.has(w)) {
        onEvent({ type: 'word-already', word: w });
        return { kind: 'already' };
      }
      foundBonus.add(w);
      storage.recordBonusWord(level.id, w);
      storage.incWordsFound(1);
      noteValid();
      onEvent({ type: 'word-bonus', word: w });
      return { kind: 'bonus' };
    }
    // Слово есть в словаре, но не подходит этому уровню — тоже invalid.
    onEvent({ type: 'word-invalid', word: w });
    noteWrong();
    return { kind: 'invalid' };
  }

  function isLevelComplete() {
    return foundMain.size === mainSet.size;
  }

  function useHint() {
    if (!cw) return false;
    const hints = storage.getHints();
    if (hints <= 0) {
      onEvent({ type: 'hint-empty' });
      return false;
    }
    const cell = cw.revealRandomHiddenCell();
    if (!cell) return false;
    storage.spendHint();
    // Использование подсказки сбрасывает счётчик ошибок и скрывает баннер.
    noteValid();
    onEvent({ type: 'hint', cell, hintsLeft: storage.getHints() });

    // Подсказка могла открыть последнюю ячейку какого-нибудь слова
    // (часто на перекрестии). Проверяем все слова — авто-зачитываем те,
    // у которых все ячейки уже видны.
    checkAndMarkRevealedWords();
    return true;
  }

  // Авто-зачитывает все ненайденные mainWords (например, после полного
  // раскрытия сетки подсказками или из чит-панели). Эмитит word-main событие на каждое.
  function autoCompleteRemaining() {
    for (const w of mainSet) {
      if (foundMain.has(w)) continue;
      foundMain.add(w);
      storage.incWordsFound(1);
      const placementIdx = level.placements.findIndex(p => normalize(p.word) === w);
      onEvent({ type: 'word-main', word: w, placementIdx, auto: true });
    }
    if (isLevelComplete()) emitLevelComplete();
  }

  // Принудительно завершить уровень (из чит-панели). Раскрывает все ячейки и
  // авто-зачитывает оставшиеся слова, эмитя level-complete.
  function forceComplete() {
    if (!cw || !level) return;
    // Раскрываем оставшиеся ячейки.
    while (cw.revealRandomHiddenCell()) { /* loop */ }
    autoCompleteRemaining();
  }

  return {
    loadLevel,
    submitWord,
    useHint,
    forceComplete,
    isLevelComplete,
    getFoundMain: () => [...foundMain],
    getFoundBonus: () => [...foundBonus],
    getHints: () => storage.getHints(),
    getLevel: () => level,
    setCrossword: (c) => { cw = c; }
  };
}
