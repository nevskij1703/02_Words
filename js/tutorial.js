// tutorial.js — простой обучающий оверлей для первого уровня.
//
// Показывает анимированную «руку» (круг с точкой), которая по очереди наводится
// на буквы первых 3 (самых коротких) слов уровня — не свайпая, не сабмитя.
// Игрок видит «как», но проходит сам.
//
// Завершение:
//   - после демонстрации всех 3 слов;
//   - либо если игрок успел сам найти слово до окончания демо.
// В обоих случаях помечает tutorialShown=true в storage.

import * as storage from './storage.js';

const TUTORIAL_KEY = 'tutorialShown';

export function shouldRun() {
  const s = storage.getSettings();
  return !s[TUTORIAL_KEY];
}

export function markDone() {
  storage.setSetting(TUTORIAL_KEY, true);
}

const HAND_SVG = `
<svg viewBox="0 0 32 32" width="44" height="44" fill="none" aria-hidden="true">
  <circle cx="16" cy="16" r="14" fill="rgba(255,255,255,0.92)" stroke="rgba(0,0,0,0.18)" stroke-width="0.6"/>
  <circle cx="16" cy="16" r="4.2" fill="#3a5a8c"/>
</svg>
`.trim();

export function run(wheelEl, mainWords) {
  // Берём 3 самых коротких слова — удобнее для первого опыта.
  const words = [...mainWords].sort((a, b) => a.length - b.length).slice(0, 3);
  if (words.length === 0) {
    markDone();
    return { cancel() {} };
  }

  let cancelled = false;
  const hand = document.createElement('div');
  hand.className = 'tut-hand';
  hand.innerHTML = HAND_SVG;
  wheelEl.appendChild(hand);

  // Текстовая подсказка над колесом — какое слово показываем.
  const label = document.createElement('div');
  label.className = 'tut-label';
  label.textContent = '';
  wheelEl.parentElement.insertBefore(label, wheelEl);

  function getLetterPos(ch) {
    const els = [...wheelEl.querySelectorAll('.wheel-letter')];
    const el = els.find(e => e.textContent === ch);
    if (!el) return null;
    return { x: parseFloat(el.style.left), y: parseFloat(el.style.top) };
  }

  function setHandPos(x, y, animate = true) {
    hand.style.transition = animate ? 'left 480ms ease-in-out, top 480ms ease-in-out' : 'none';
    hand.style.left = `${x}px`;
    hand.style.top  = `${y}px`;
  }

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function demoWord(word) {
    if (cancelled) return;
    label.textContent = `Например: ${word}`;
    label.classList.add('visible');
    // Подвести руку к первой букве без транзишена.
    const p0 = getLetterPos(word[0]);
    if (!p0) return;
    setHandPos(p0.x, p0.y, false);
    hand.classList.add('visible');
    hand.classList.add('pulse');
    await wait(700);
    for (let i = 1; i < word.length; i++) {
      if (cancelled) return;
      const p = getLetterPos(word[i]);
      if (!p) continue;
      hand.classList.remove('pulse');
      setHandPos(p.x, p.y, true);
      await wait(520);
      hand.classList.add('pulse');
      await wait(180);
    }
    await wait(600);
    hand.classList.remove('pulse', 'visible');
    label.classList.remove('visible');
    await wait(400);
  }

  async function play() {
    // Небольшая пауза, чтобы игрок успел осознать сцену.
    await wait(800);
    for (const w of words) {
      if (cancelled) return;
      await demoWord(w);
    }
    finish();
  }

  function finish() {
    cancelled = true;
    hand.classList.add('fade-out');
    label.classList.add('fade-out');
    setTimeout(() => { hand.remove(); label.remove(); }, 400);
    markDone();
  }

  play();

  return {
    cancel: finish
  };
}
