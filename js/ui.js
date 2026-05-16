// ui.js — DOM-разметка, экраны, кнопки и события игры.

import * as crossword from './crossword.js';
import { createLetterWheel } from './input.js';
import { createGame } from './game.js';
import * as audio from './audio.js';
import * as ads from './ads.js';
import * as storage from './storage.js';
import { CONFIG } from './config.js';
// HTML2APK:DEV_ONLY_BEGIN
import { showCheatPanel, attachSecretTap, setHooks as setCheatHooks } from './cheatPanel.js';
// HTML2APK:DEV_ONLY_END
import * as tutorial from './tutorial.js';
import * as cells from './cells.js';
import * as rateUs from './rateUs.js';
import { showSettingsDialog } from './settings.js';

// Aurora-стилистика: контурные иконки с currentColor + waves-on/off через <g>.
const ICON_HINT = `
<svg viewBox="0 0 24 28" fill="none" aria-hidden="true">
  <path d="M12 2C7.5 2 4 5.5 4 10c0 2.8 1.4 4.7 2.5 6.2c.8 1.1 1.5 2 1.5 3.3v.5h8v-.5c0-1.3.7-2.2 1.5-3.3C18.6 14.7 20 12.8 20 10c0-4.5-3.5-8-8-8z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M9 23h6M10.5 26h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M12 8v6M9.5 11.5L12 14l2.5-2.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity="0.4"/>
</svg>`.trim();

// Иконка «настройки» — шестерёнка. Объединяет старые звук+тему: тапаем
// здесь → открывается окно настроек с тоглами + ссылкой на политику.
const ICON_SETTINGS = `
<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z"
        stroke="currentColor" stroke-width="1.8" fill="currentColor" fill-opacity="0.18"/>
  <path d="M19.4 13.6c.04-.5.06-1.1.06-1.6s-.02-1.1-.06-1.6l2.1-1.6-2-3.4-2.4 1c-.8-.6-1.7-1.1-2.6-1.4L14 2.5h-4l-.5 2.5c-.9.3-1.8.8-2.6 1.4l-2.4-1-2 3.4 2.1 1.6c-.04.5-.06 1.1-.06 1.6s.02 1.1.06 1.6l-2.1 1.6 2 3.4 2.4-1c.8.6 1.7 1.1 2.6 1.4l.5 2.5h4l.5-2.5c.9-.3 1.8-.8 2.6-1.4l2.4 1 2-3.4-2.1-1.6z"
        stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" fill="none"/>
</svg>`.trim();

// === Сборка статической разметки ===
function buildLayout(app) {
  app.innerHTML = `
    <div class="top-bar">
      <div class="level-info" id="level-info">
        Уровень<span class="num" id="level-num">1</span>
      </div>
      <div class="top-buttons">
        <button class="icon-btn icon-svg" id="btn-hint" title="Подсказка" aria-label="Подсказка">${ICON_HINT}<span class="badge" id="hint-count">0</span></button>
        <button class="icon-btn icon-svg" id="btn-settings" title="Настройки" aria-label="Настройки">${ICON_SETTINGS}</button>
      </div>
    </div>
    <div class="crossword-wrap" id="crossword-wrap"></div>
    <div class="bonus-row" id="bonus-row"></div>
    <div class="current-word" id="current-word"></div>
    <div class="hint-banner hidden" id="hint-banner">
      <button id="btn-hint-banner">
        <span class="hint-banner-icon">💡</span>
        <span>Использовать подсказку</span>
      </button>
    </div>
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
    settingsBtn:app.querySelector('#btn-settings'),
    levelNum:   app.querySelector('#level-num'),
    crosswordW: app.querySelector('#crossword-wrap'),
    bonusRow:   app.querySelector('#bonus-row'),
    currentWord:app.querySelector('#current-word'),
    hintBanner: app.querySelector('#hint-banner'),
    hintBannerBtn: app.querySelector('#btn-hint-banner'),
    wheelEl:    app.querySelector('#wheel')
  };

  let tutorialControl = null;

  // Регистрируем игровую сессию (для логики Rate Us — окно появляется только
  // со 2-й сессии и далее, и только один раз за сессию). bumpSessionIfNew()
  // идемпотентно для одной сессии благодаря sessionStorage-маркеру.
  rateUs.bumpSessionIfNew();
  // Сколько уровней игрок ЗАВЕРШИЛ в текущей сессии. Увеличивается по нажатию
  // «Дальше» на экране победы. Когда == 2 (т.е. идём в 3-й уровень сессии) —
  // показываем окно Rate Us вместо очередной интерстишиал-рекламы.
  let levelsCompletedThisSession = 0;

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

  function currentTheme() {
    const s = storage.getSettings();
    return s.theme === 'dark' ? 'dark' : 'light';
  }

  // Применяет тему: data-theme на <html> (для CSS-переменных) + theme-color
  // в meta для системного статус-бара. Пробрасывается в settings.js,
  // чтобы окно настроек могло переключать тему через тот же путь.
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0a0820' : '#f4ecf7');
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
    if (els.levelNum) els.levelNum.textContent = String(idx + 1);
    refreshHintBadge();

    cwApi = crossword.render(level, els.crosswordW, {
      // Каждое открытие ячейки (свайп/подсказка/чит-завершение) пишется
      // в отдельное хранилище (cells.js). На рестарте уровень
      // восстанавливается из этих данных.
      onCellReveal: (r, c) => cells.addCell(level.id, r, c)
    });
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

    // Скрыть баннер «Использовать подсказку» при загрузке.
    hideHintBanner();

    // Тутор только на первом уровне и только если ещё не показан.
    if (tutorialControl) { tutorialControl.cancel(); tutorialControl = null; }
    if (idx === 0 && tutorial.shouldRun()) {
      setTimeout(() => {
        if (storage.getCurrentLevel() === 0 && tutorial.shouldRun()) {
          tutorialControl = tutorial.run(els.wheelEl, {
            // Тутор каждый раз спрашивает: «какое слово сейчас показывать?».
            // Возвращаем самое короткое из main-слов, которые ещё не открыты.
            // Если все главные слова найдены — null → тутор завершится.
            getNextTarget: () => {
              if (!game || !level) return null;
              const found = new Set(game.getFoundMain().map(w => String(w).toUpperCase()));
              const unfound = level.mainWords
                .map(w => String(w).toUpperCase())
                .filter(w => !found.has(w));
              if (unfound.length === 0) return null;
              return unfound.slice().sort((a, b) => a.length - b.length)[0];
            },
            maxSteps: 3
          });
        }
      }, 500);
    }

    storage.setCurrentLevel(idx);
  }

  function handleGameEvent(ev) {
    switch (ev.type) {
      case 'word-bonus':
        addBonusPill(ev.word);
        break;
      case 'word-main':
        // Сообщаем тутору, что игрок нашёл слово — тутор решит, продвинуться
        // ли на следующее, или продолжить демо текущего.
        if (tutorialControl) tutorialControl.notifyWordFound(ev.word);
        break;
      case 'level-complete':
        refillHintsAfterLevel();
        setTimeout(() => showWinScreen(), 700);
        break;
      case 'hint':
        refreshHintBadge();
        audio.play('hint');
        break;
      case 'hint-empty':
        showRewardedAskForHint();
        break;
      case 'show-hint-banner':
        showHintBanner();
        break;
      case 'hide-hint-banner':
        hideHintBanner();
        break;
    }
  }

  // Сколько подсказок пополнено последним уровнем — для отображения на экране победы.
  let lastRefillDelta = 0;

  // Пополняем подсказки после уровня до потолка (config.BALANCE.hintsRefillCap).
  function refillHintsAfterLevel() {
    const cur = storage.getHints();
    const cap = CONFIG.BALANCE.hintsRefillCap;
    if (cur < cap) {
      storage.addHints(1);
      refreshHintBadge();
      lastRefillDelta = 1;
    } else {
      lastRefillDelta = 0;
    }
  }

  // === Баннер «Использовать подсказку» (показывается после 3 ошибок подряд) ===

  function showHintBanner() {
    els.hintBanner.classList.remove('hidden');
  }

  function hideHintBanner() {
    els.hintBanner.classList.add('hidden');
  }

  els.hintBannerBtn.addEventListener('click', async () => {
    audio.play('click');
    hideHintBanner();
    if (!game) return;
    const hints = storage.getHints();
    if (hints > 0) {
      game.useHint();
      return;
    }
    // Подсказок нет — сразу запускаем rewarded-рекламу.
    const res = await ads.showRewardedAd();
    if (res?.rewarded) {
      storage.addHints(CONFIG.BALANCE.hintsPerRewardedAd);
      refreshHintBadge();
      // И сразу же используем одну для открытия буквы.
      game.useHint();
    }
  });

  // === Кнопки ===
  els.hintBtn.addEventListener('click', () => {
    audio.play('click');
    if (game) game.useHint();
  });

  els.settingsBtn.addEventListener('click', () => {
    audio.play('click');
    showSettingsDialog({ audio, storage, applyTheme });
  });

  // Применяем сохранённую тему сразу при монтировании.
  applyTheme(currentTheme());

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
    const overlay = document.createElement('div');
    overlay.className = 'win-screen';
    const rewardHtml = lastRefillDelta > 0
      ? `<div class="stats">Награда: <b>+${lastRefillDelta}</b> <span class="reward-icon">💡</span></div>`
      : `<div class="stats" style="color:#888">Подсказки уже на максимуме</div>`;
    overlay.innerHTML = `
      <div class="win-card">
        <h2>Уровень пройден!</h2>
        ${rewardHtml}
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
      // Засчитываем уровень в счётчик текущей игровой сессии.
      // ВАЖНО: инкрементируем именно здесь (а не в level-complete), потому что
      // RateUs показывается ПЕРЕД стартом следующего уровня, и нам важен счёт
      // именно «уровней, после которых игрок нажал Дальше в этой сессии».
      levelsCompletedThisSession++;

      currentLevelIdx = nextIdx;
      // Сохраняем индекс СРАЗУ — если приложение умрёт во время показа
      // рекламы или окна, при перезапуске мы окажемся на правильном уровне.
      storage.setCurrentLevel(currentLevelIdx);

      // Окно Rate Us всегда показывается ПЕРЕД интерстишиалом (если оно
      // вообще запланировано) — обратный порядок нелогичен (после рекламы
      // игрок раздражён, оценку просить бессмысленно).
      //
      // Что делаем с рекламой после закрытия окна:
      //   - 'rate'   → игрок только что сделал нам услугу, рекламу пропускаем,
      //                чтобы не портить позитивный момент;
      //   - 'later'  → игрок отказался; ведём себя как обычно — если интерстишиал
      //                на этом переходе запланирован, показываем после RateUs.
      // Если RateUs вообще не сработал — стандартный путь, только реклама.
      let showInterstitial = false;
      if (rateUs.shouldShowOnLevelStart(levelsCompletedThisSession)) {
        const { action } = await rateUs.showRateUsDialog();
        if (action === 'later' && ads.shouldShowInterstitial(currentLevelIdx)) {
          showInterstitial = true;
        }
      } else if (ads.shouldShowInterstitial(currentLevelIdx)) {
        showInterstitial = true;
      }
      if (showInterstitial) {
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
  // HTML2APK:DEV_ONLY_BEGIN
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
  // HTML2APK:DEV_ONLY_END

  // === Запуск ===
  // Если игрок в прошлой сессии не досмотрел интерстишиал и быстро вернулся,
  // показываем его ПЕРЕД первой загрузкой уровня. consumePendingResume()
  // снимает флаг — повторно само по себе не сработает.
  if (ads.hasPendingResumeInterstitial && ads.hasPendingResumeInterstitial()) {
    ads.consumePendingResume();
    try {
      await ads.showInterstitialAd();
    } catch (e) { console.warn('[ui] resume interstitial failed', e); }
  }
  await loadLevel(currentLevelIdx);

  return {
    nextLevel: () => loadLevel(currentLevelIdx + 1),
    reload:    () => loadLevel(currentLevelIdx),
    // HTML2APK:DEV_ONLY_BEGIN
    showCheatPanel,
    // HTML2APK:DEV_ONLY_END
  };
}
