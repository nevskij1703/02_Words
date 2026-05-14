// ui.js — DOM-разметка, экраны, кнопки и события игры.

import * as crossword from './crossword.js';
import { createLetterWheel } from './input.js';
import { createGame } from './game.js';
import * as audio from './audio.js';
import * as ads from './ads.js';
import * as storage from './storage.js';
import { CONFIG } from './config.js';
import { showCheatPanel, attachSecretTap, setHooks as setCheatHooks } from './cheatPanel.js';

// Минималистичные SVG-иконки звука. stroke=currentColor → наследуют цвет кнопки.
const ICON_SOUND_ON = `
<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M11 5 L6 9 H3 V15 H6 L11 19 Z"/>
  <path d="M15.5 8.8 a3.6 3.6 0 0 1 0 6.4"/>
  <path d="M18.6 5.6 a7.6 7.6 0 0 1 0 12.8"/>
</svg>`.trim();

const ICON_SOUND_OFF = `
<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M11 5 L6 9 H3 V15 H6 L11 19 Z"/>
  <line x1="16.5" y1="9.5" x2="21.5" y2="14.5"/>
  <line x1="21.5" y1="9.5" x2="16.5" y2="14.5"/>
</svg>`.trim();

// === Сборка статической разметки ===
function buildLayout(app) {
  app.innerHTML = `
    <div class="top-bar">
      <div class="level-info" id="level-info">Уровень 1</div>
      <div class="top-buttons">
        <button class="icon-btn" id="btn-hint" title="Подсказка">💡<span class="badge" id="hint-count">0</span></button>
        <button class="icon-btn icon-svg" id="btn-sound" title="Звук">${ICON_SOUND_ON}</button>
      </div>
    </div>
    <div class="crossword-wrap" id="crossword-wrap"></div>
    <div class="bonus-row" id="bonus-row"></div>
    <div class="current-word" id="current-word"></div>
    <div class="wheel-area">
      <div class="wheel" id="wheel"></div>
    </div>
  `;
}

export async function mountGame(app, allLevels) {
  buildLayout(app);

  const els = {
    levelInfo:  app.querySelector('#level-info'),
    hintBtn:    app.querySelector('#btn-hint'),
    hintCount:  app.querySelector('#hint-count'),
    soundBtn:   app.querySelector('#btn-sound'),
    crosswordW: app.querySelector('#crossword-wrap'),
    bonusRow:   app.querySelector('#bonus-row'),
    currentWord:app.querySelector('#current-word'),
    wheelEl:    app.querySelector('#wheel')
  };

  let currentLevelIdx = storage.getCurrentLevel();
  if (currentLevelIdx >= allLevels.length) currentLevelIdx = allLevels.length - 1;

  let cwApi = null;
  let game = null;
  let wheel = null;

  function refreshHintBadge() {
    const h = storage.getHints();
    els.hintCount.textContent = String(h);
    els.hintCount.style.display = h > 0 ? '' : 'none';
  }

  function refreshSoundIcon() {
    els.soundBtn.innerHTML = audio.isEnabled() ? ICON_SOUND_ON : ICON_SOUND_OFF;
  }

  function clearBonusRow() {
    els.bonusRow.innerHTML = '';
  }

  function addBonusPill(word) {
    const pill = document.createElement('span');
    pill.className = 'bonus-pill';
    pill.textContent = word;
    els.bonusRow.appendChild(pill);
  }

  async function loadLevel(idx) {
    // Очистка предыдущего состояния.
    if (wheel) wheel.destroy();
    els.crosswordW.innerHTML = '';
    clearBonusRow();
    els.currentWord.textContent = '';
    els.currentWord.className = 'current-word';

    const level = allLevels[idx];
    els.levelInfo.textContent = `Уровень ${idx + 1}`;
    refreshHintBadge();
    refreshSoundIcon();

    cwApi = crossword.render(level, els.crosswordW);
    game = createGame({ onEvent: handleGameEvent });
    game.setCrossword(cwApi);
    game.loadLevel(level);

    // Восстановить уже найденные бонусы.
    for (const w of game.getFoundBonus()) addBonusPill(w);

    wheel = createLetterWheel(els.wheelEl, {
      onWordPreview(word) {
        els.currentWord.textContent = word;
        els.currentWord.className = 'current-word';
      },
      onWordSubmit(word) {
        audio.play('click');
        const res = game.submitWord(word);
        if (res.kind === 'invalid') {
          els.currentWord.classList.add('bad');
          wheel.shake();
          audio.play('wrong');
          if (storage.getSettings().vibration && navigator.vibrate) {
            navigator.vibrate(CONFIG.HAPTIC.badWordMs);
          }
          setTimeout(() => { els.currentWord.textContent = ''; els.currentWord.className = 'current-word'; }, 600);
        } else if (res.kind === 'already') {
          els.currentWord.classList.add('bad');
          setTimeout(() => { els.currentWord.textContent = ''; els.currentWord.className = 'current-word'; }, 400);
        } else if (res.kind === 'main') {
          els.currentWord.classList.add('good');
          audio.play('correct');
          if (storage.getSettings().vibration && navigator.vibrate) {
            navigator.vibrate(CONFIG.HAPTIC.correctWordMs);
          }
          setTimeout(() => { els.currentWord.textContent = ''; els.currentWord.className = 'current-word'; }, 700);
        } else if (res.kind === 'bonus') {
          els.currentWord.classList.add('bonus');
          audio.play('bonus');
          setTimeout(() => { els.currentWord.textContent = ''; els.currentWord.className = 'current-word'; }, 700);
        }
      }
    });
    wheel.setLetters(level.letters);

    storage.setCurrentLevel(idx);
  }

  function handleGameEvent(ev) {
    switch (ev.type) {
      case 'word-bonus':
        addBonusPill(ev.word);
        break;
      case 'level-complete':
        setTimeout(() => showWinScreen(), 700);
        break;
      case 'hint':
        refreshHintBadge();
        audio.play('hint');
        break;
      case 'hint-empty':
        showRewardedAskForHint();
        break;
    }
  }

  // === Кнопки ===
  els.hintBtn.addEventListener('click', () => {
    audio.play('click');
    if (game) game.useHint();
  });

  els.soundBtn.addEventListener('click', () => {
    const on = audio.toggle();
    if (on) audio.play('click');
    refreshSoundIcon();
  });

  // === Диалог: подсказки кончились, посмотреть рекламу? ===
  function showRewardedAskForHint() {
    const overlay = document.createElement('div');
    overlay.className = 'dialog';
    overlay.innerHTML = `
      <div class="dialog-card">
        <h3>Подсказки закончились</h3>
        <p>Посмотрите короткую рекламу, чтобы получить +${CONFIG.BALANCE.hintsPerRewardedAd} подсказки.</p>
        <div class="dialog-buttons">
          <button class="secondary" id="dlg-cancel">Отмена</button>
          <button class="primary" id="dlg-watch">Смотреть</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#dlg-cancel').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#dlg-watch').addEventListener('click', async () => {
      overlay.remove();
      const { rewarded } = await ads.showRewardedAd();
      if (rewarded) {
        storage.addHints(CONFIG.BALANCE.hintsPerRewardedAd);
        refreshHintBadge();
        game.useHint();
      }
    });
  }

  // === Экран победы ===
  function showWinScreen() {
    const lvl = game.getLevel();
    const main = game.getFoundMain();
    const bonus = game.getFoundBonus();
    const overlay = document.createElement('div');
    overlay.className = 'win-screen';
    overlay.innerHTML = `
      <div class="win-card">
        <h2>Уровень пройден!</h2>
        <div class="stats">
          Слов кроссворда: <b>${main.length}</b><br>
          Бонусных слов: <b>${bonus.length}</b>
          ${bonus.length ? `<br><small style="color:#888">${bonus.slice(0, 10).join(', ')}${bonus.length > 10 ? '…' : ''}</small>` : ''}
        </div>
        <button class="next-btn" id="win-next">Дальше</button>
      </div>`;
    document.body.appendChild(overlay);
    audio.play('win');
    overlay.querySelector('#win-next').addEventListener('click', async () => {
      overlay.remove();
      const nextIdx = currentLevelIdx + 1;
      if (nextIdx >= allLevels.length) {
        // Конец доступных уровней — показать сообщение.
        showEndScreen();
        return;
      }
      currentLevelIdx = nextIdx;
      if (ads.shouldShowInterstitial(currentLevelIdx)) {
        await ads.showInterstitialAd();
      }
      loadLevel(currentLevelIdx);
    });
  }

  function showEndScreen() {
    const overlay = document.createElement('div');
    overlay.className = 'win-screen';
    overlay.innerHTML = `
      <div class="win-card">
        <h2>Поздравляем!</h2>
        <div class="stats">Вы прошли все доступные уровни. Скоро будут новые.</div>
        <button class="next-btn" id="win-restart">К началу</button>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#win-restart').addEventListener('click', () => {
      overlay.remove();
      currentLevelIdx = 0;
      loadLevel(0);
    });
  }

  // === Чит-панель (5 быстрых тапов по заголовку уровня) ===
  setCheatHooks({
    totalLevels: allLevels.length,
    onJumpTo: (idx) => {
      currentLevelIdx = Math.max(0, Math.min(allLevels.length - 1, idx));
      loadLevel(currentLevelIdx);
    },
    onCompleteLevel: () => {
      if (game) game.forceComplete();
    }
  });
  attachSecretTap(els.levelInfo, () => showCheatPanel());

  // Также: query-параметр ?cheat=1 откроет панель сразу.
  if (new URLSearchParams(location.search).get('cheat') === '1') {
    setTimeout(() => showCheatPanel(), 200);
  }

  // === Запуск ===
  await loadLevel(currentLevelIdx);

  return {
    nextLevel: () => loadLevel(currentLevelIdx + 1),
    reload:    () => loadLevel(currentLevelIdx),
    showCheatPanel
  };
}
