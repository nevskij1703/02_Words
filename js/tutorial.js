// tutorial.js — обучающий оверлей для первого уровня.
//
// Поведение:
//   1. На каждом шаге тутор берёт самое короткое из ЕЩЁ НЕ НАЙДЕННЫХ
//      main-слов (через колбэк getNextTarget от ui.js → game.js).
//      Закэшировать на старте нельзя: игрок может найти слово сам, и тогда
//      следующая итерация должна показать другое.
//   2. Демо повторяется, пока игрок не введёт показанное слово.
//      После этого засчитываем шаг и берём следующее ненайденное.
//   3. Максимум 3 шага; если все слова закончились раньше — заканчиваем.
//
// Линия трассы рисуется ВСЛЕД за движением руки (rAF-интерполяция,
// синхронизированная с CSS-транзишеном left/top 480ms).

import * as storage from './storage.js';

// Тутор стартует на первом уровне, пока игрок не прошёл ни один уровень.
export function shouldRun() {
  const state = storage.getState();
  return !(state.completedLevels && state.completedLevels.length > 0);
}

export function markDone() {
  // No-op (поведение завязано на completedLevels — флаг больше не пишется).
}

// Минималистичный вектор-указатель в палитре Aurora (без обводки).
const HAND_SVG = `
<svg viewBox="0 0 24 24" width="46" height="46" aria-hidden="true">
  <defs>
    <linearGradient id="tutHandGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%"  stop-color="#5b3eea"/>
      <stop offset="100%" stop-color="#e35aa3"/>
    </linearGradient>
  </defs>
  <g transform="rotate(-15 12 12)">
    <path
      d="M11 2.2c-1.1 0-2 0.9-2 2v8.8L7.5 11.5c-0.6-0.6-1.5-0.6-2.1 0-0.6 0.6-0.6 1.5 0 2.1l3.7 3.7c0.5 0.5 1 0.9 1.6 1.1 0.8 0.3 1.6 0.4 2.5 0.4h2.1c2.2 0 4-1.8 4-4v-3.6c0-0.9-0.6-1.7-1.5-1.9l-4.8-1.2V4.2c0-1.1-0.9-2-2-2z"
      fill="url(#tutHandGrad)"
    />
  </g>
</svg>
`.trim();

const HAND_MOVE_MS = 480;     // должно совпадать с CSS-транзишеном setHandPos
const TRAIL_ANIM_MS = 480;    // линия растёт ровно столько же времени
const PAUSE_AT_LETTER_MS = 180;
const PAUSE_FIRST_MS = 700;
const PAUSE_END_MS = 600;
const PAUSE_BETWEEN_LOOPS_MS = 900;

export function run(wheelEl, options = {}) {
  // Совместимость со старой сигнатурой run(wheelEl, mainWordsArray).
  let getNextTarget;
  let maxSteps;
  if (Array.isArray(options)) {
    const words = [...options].sort((a, b) => a.length - b.length).slice(0, 3).map(w => w.toUpperCase());
    let idx = 0;
    getNextTarget = () => idx < words.length ? words[idx] : null;
    // bumpIdx после успешного шага не нужен — тутор сам решает по cancelCurrent.
    // На старом API теряем динамическую отдачу — оставлено как fallback.
    maxSteps = words.length;
  } else {
    getNextTarget = typeof options.getNextTarget === 'function' ? options.getNextTarget : () => null;
    maxSteps = options.maxSteps || 3;
  }

  if (!getNextTarget()) {
    markDone();
    return { cancel() {}, notifyWordFound() {} };
  }

  let cancelled = false;
  let cancelCurrent = false;        // прерывание текущей итерации demoWord
  let stepsCompleted = 0;           // сколько слов уже пройдено через тутор
  let currentTarget = null;         // слово, которое сейчас показывается

  const hand = document.createElement('div');
  hand.className = 'tut-hand';
  hand.innerHTML = HAND_SVG;
  wheelEl.appendChild(hand);

  // Полупрозрачная трасса — отдельная polyline в существующем SVG колеса.
  // Использует тот же градиент, что и боевая трасса (см. input.js).
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const wheelSvg = wheelEl.querySelector('.wheel-svg');
  let tutPolyline = null;
  let tutGradId = null;
  if (wheelSvg) {
    const existingGrad = wheelSvg.querySelector('defs linearGradient');
    if (existingGrad) tutGradId = existingGrad.id;
    tutPolyline = document.createElementNS(SVG_NS, 'polyline');
    tutPolyline.setAttribute('fill', 'none');
    tutPolyline.setAttribute('stroke', tutGradId ? `url(#${tutGradId})` : '#5b3eea');
    tutPolyline.setAttribute('stroke-width', '1.4');
    tutPolyline.setAttribute('stroke-linejoin', 'round');
    tutPolyline.setAttribute('stroke-linecap', 'round');
    tutPolyline.setAttribute('opacity', '0.55');
    tutPolyline.classList.add('tut-trail');
    wheelSvg.appendChild(tutPolyline);
  }
  // Точки уже «зафиксированных» сегментов трассы (последняя точка = текущий конец).
  const visitedPts = [];
  let trailAnimRAF = 0;

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
    cancelTrailAnim();
    visitedPts.length = 0;
    refreshTrail();
  }

  function cancelTrailAnim() {
    if (trailAnimRAF) {
      cancelAnimationFrame(trailAnimRAF);
      trailAnimRAF = 0;
    }
  }

  // Анимированно «протягивает» линию от текущего конца до toPt за durationMs.
  // Добавляет новую точку в visitedPts и подвигает её во времени; в конце
  // точка стоит ровно в toPt.
  function animateTrailTo(toPt, durationMs) {
    if (!tutPolyline) return;
    cancelTrailAnim();
    if (visitedPts.length === 0) {
      visitedPts.push({ x: toPt.x, y: toPt.y });
      refreshTrail();
      return;
    }
    const start = visitedPts[visitedPts.length - 1];
    const fromX = start.x, fromY = start.y;
    visitedPts.push({ x: fromX, y: fromY });
    const movingIdx = visitedPts.length - 1;
    const t0 = performance.now();
    const easeInOut = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    function step(now) {
      const t = Math.min(1, (now - t0) / durationMs);
      const e = easeInOut(t);
      visitedPts[movingIdx].x = fromX + (toPt.x - fromX) * e;
      visitedPts[movingIdx].y = fromY + (toPt.y - fromY) * e;
      refreshTrail();
      if (t < 1 && !cancelled) {
        trailAnimRAF = requestAnimationFrame(step);
      } else {
        trailAnimRAF = 0;
      }
    }
    trailAnimRAF = requestAnimationFrame(step);
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
    hand.style.transition = animate
      ? `left ${HAND_MOVE_MS}ms ease-in-out, top ${HAND_MOVE_MS}ms ease-in-out`
      : 'none';
    hand.style.left = `${x}px`;
    hand.style.top  = `${y}px`;
  }

  function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  async function demoWord(word) {
    if (cancelled) return;
    label.textContent = `Например: ${word}`;
    label.classList.add('visible');
    clearTrail();
    // Подвести руку к первой букве без транзишена.
    const p0 = getLetterPos(word[0]);
    if (!p0) { label.classList.remove('visible'); return; }
    setHandPos(p0.x, p0.y, false);
    visitedPts.push({ x: p0.x, y: p0.y });
    refreshTrail();
    hand.classList.add('visible');
    hand.classList.add('pulse');
    await wait(PAUSE_FIRST_MS);
    for (let i = 1; i < word.length; i++) {
      if (cancelled || cancelCurrent) break;
      const p = getLetterPos(word[i]);
      if (!p) continue;
      hand.classList.remove('pulse');
      // Линия и рука стартуют одновременно и идут одинаковую длительность.
      animateTrailTo({ x: p.x, y: p.y }, TRAIL_ANIM_MS);
      setHandPos(p.x, p.y, true);
      await wait(HAND_MOVE_MS + 40);
      if (cancelled || cancelCurrent) break;
      hand.classList.add('pulse');
      await wait(PAUSE_AT_LETTER_MS);
    }
    if (!cancelled && !cancelCurrent) await wait(PAUSE_END_MS);
    cancelTrailAnim();
    hand.classList.remove('pulse', 'visible');
    label.classList.remove('visible');
    if (tutPolyline) tutPolyline.style.transition = 'opacity 400ms';
    if (tutPolyline) tutPolyline.style.opacity = '0';
    await wait(420);
    clearTrail();
    if (tutPolyline) { tutPolyline.style.transition = ''; tutPolyline.style.opacity = ''; }
  }

  async function play() {
    await wait(800);
    while (!cancelled && stepsCompleted < maxSteps) {
      cancelCurrent = false;
      // Получаем актуальную цель: самое короткое ненайденное main-слово.
      const target = (getNextTarget() || '').toString().toUpperCase();
      if (!target) break;
      currentTarget = target;
      await demoWord(target);
      if (cancelled) break;
      if (cancelCurrent) {
        // Игрок ввёл показанное слово — засчитываем шаг и берём следующее.
        stepsCompleted++;
      } else {
        // Демо завершилось без угадывания — пауза и повторяем то же слово.
        await wait(PAUSE_BETWEEN_LOOPS_MS);
      }
    }
    finish();
  }

  function finish() {
    cancelled = true;
    cancelTrailAnim();
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
    cancel: finish,
    // ui.js дёргает это при word-main событии (игрок угадал слово).
    // Если это слово, которое сейчас показывается — прерываем демо
    // и продвигаем счётчик. Любое другое слово игнорируем (на следующей
    // итерации getNextTarget сам учтёт его как найденное).
    notifyWordFound(word) {
      if (cancelled) return;
      const w = (word || '').toString().toUpperCase();
      if (currentTarget && w === currentTarget) {
        cancelCurrent = true;
      }
    }
  };
}
