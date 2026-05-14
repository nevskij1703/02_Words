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

// Минималистичный вектор-указатель: рука, индексный палец вверх (Material-style).
// Жёлто-оранжевая заливка для контраста с белыми кнопками-буквами +
// тонкий тёмный контур, нос «давит» круглую тень.
const HAND_SVG = `
<svg viewBox="0 0 24 24" width="46" height="46" aria-hidden="true">
  <g transform="rotate(-15 12 12)">
    <path
      d="M11 2.2c-1.1 0-2 0.9-2 2v8.8L7.5 11.5c-0.6-0.6-1.5-0.6-2.1 0-0.6 0.6-0.6 1.5 0 2.1l3.7 3.7c0.5 0.5 1 0.9 1.6 1.1 0.8 0.3 1.6 0.4 2.5 0.4h2.1c2.2 0 4-1.8 4-4v-3.6c0-0.9-0.6-1.7-1.5-1.9l-4.8-1.2V4.2c0-1.1-0.9-2-2-2z"
      fill="#ffb84d"
      stroke="#1a2540"
      stroke-width="1.4"
      stroke-linejoin="round"
      stroke-linecap="round"
    />
  </g>
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

  // Полупрозрачная трасса — такого же цвета, как боевая, но прозрачнее.
  // Подмешиваем в существующий SVG-overlay колеса.
  const wheelSvg = wheelEl.querySelector('.wheel-svg');
  let tutPolyline = null;
  if (wheelSvg) {
    tutPolyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    tutPolyline.setAttribute('fill', 'none');
    tutPolyline.setAttribute('stroke', '#ffb84d');
    tutPolyline.setAttribute('stroke-width', '3');
    tutPolyline.setAttribute('stroke-linejoin', 'round');
    tutPolyline.setAttribute('stroke-linecap', 'round');
    tutPolyline.setAttribute('opacity', '0.38');
    tutPolyline.classList.add('tut-trail');
    wheelSvg.appendChild(tutPolyline);
  }
  const visitedPts = [];

  function refreshTrail() {
    if (!tutPolyline) return;
    const rect = wheelEl.getBoundingClientRect();
    if (!rect.width) { tutPolyline.setAttribute('points', ''); return; }
    const pts = visitedPts.map(p => {
      const x = (p.x / rect.width) * 100;
      const y = (p.y / rect.height) * 100;
      return `${x},${y}`;
    }).join(' ');
    tutPolyline.setAttribute('points', pts);
  }

  function clearTrail() {
    visitedPts.length = 0;
    refreshTrail();
  }

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
    clearTrail();
    // Подвести руку к первой букве без транзишена.
    const p0 = getLetterPos(word[0]);
    if (!p0) return;
    setHandPos(p0.x, p0.y, false);
    visitedPts.push({ x: p0.x, y: p0.y });
    refreshTrail();
    hand.classList.add('visible');
    hand.classList.add('pulse');
    await wait(700);
    for (let i = 1; i < word.length; i++) {
      if (cancelled) return;
      const p = getLetterPos(word[i]);
      if (!p) continue;
      hand.classList.remove('pulse');
      // Линия рисуется чуть раньше движения руки — рука «идёт по следу».
      visitedPts.push({ x: p.x, y: p.y });
      refreshTrail();
      setHandPos(p.x, p.y, true);
      await wait(520);
      hand.classList.add('pulse');
      await wait(180);
    }
    await wait(600);
    hand.classList.remove('pulse', 'visible');
    label.classList.remove('visible');
    // Аккуратно гасим линию: уменьшаем opacity, потом стираем.
    if (tutPolyline) tutPolyline.style.transition = 'opacity 400ms';
    if (tutPolyline) tutPolyline.style.opacity = '0';
    await wait(420);
    clearTrail();
    if (tutPolyline) { tutPolyline.style.transition = ''; tutPolyline.style.opacity = ''; }
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
    if (tutPolyline) {
      tutPolyline.style.transition = 'opacity 300ms';
      tutPolyline.style.opacity = '0';
    }
    setTimeout(() => {
      hand.remove();
      label.remove();
      if (tutPolyline) tutPolyline.remove();
    }, 400);
    markDone();
  }

  play();

  return {
    cancel: finish
  };
}
