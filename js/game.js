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
import { CONFIG } from './config.js';

export function createGame({ onEvent = () => {}, crossword = null } = {}) {
  let level = null;
  let foundMain = new Set();
  let foundBonus = new Set();
  let bonusSet = new Set();
  let mainSet = new Set();
  let wrongStreak = 0;
  let hintBannerVisible = false;

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

    // Учитываем уже найденные ранее бонусы из storage (по идее их игрок
    // нашёл при предыдущем заходе на уровень).
    const saved = storage.getFoundBonus(lv.id);
    for (const w of saved) foundBonus.add(normalize(w));
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
      foundMain.add(w);
      storage.incWordsFound(1);
      noteValid();
      const placementIdx = level.placements.findIndex(p => normalize(p.word) === w);
      if (cw && placementIdx >= 0) cw.revealPlacement(placementIdx);
      onEvent({ type: 'word-main', word: w, placementIdx });
      if (isLevelComplete()) {
        storage.markLevelCompleted(level.id);
        onEvent({ type: 'level-complete' });
      }
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

    // Если подсказка раскрыла последнюю закрытую ячейку — авто-зачёт
    // оставшихся ненайденных слов и переход к экрану «Уровень пройден».
    if (cw.isAllRevealed()) {
      autoCompleteRemaining();
    }
    return true;
  }

  // Авто-зачитывает все ненайденные mainWords (например, после полного
  // раскрытия сетки подсказками). Эмитит word-main событие на каждое.
  function autoCompleteRemaining() {
    for (const w of mainSet) {
      if (foundMain.has(w)) continue;
      foundMain.add(w);
      storage.incWordsFound(1);
      const placementIdx = level.placements.findIndex(p => normalize(p.word) === w);
      onEvent({ type: 'word-main', word: w, placementIdx });
    }
    if (isLevelComplete()) {
      storage.markLevelCompleted(level.id);
      onEvent({ type: 'level-complete' });
    }
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
