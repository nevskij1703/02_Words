// input.js — круг букв с вводом свайпом/кликами.
//
// Использование:
//   const wheel = createLetterWheel(container, {
//     onWordSubmit(word) {...},     // когда отпустили палец
//     onWordPreview(word) {...},    // на каждом изменении выделения
//     onSelectionStart() {...}
//   });
//   wheel.setLetters(['К','О','Т']);
//   wheel.shuffle();
//   wheel.reset();

const HIT_RADIUS_PX = 30;          // расстояние от центра буквы для попадания
const MIN_DRAG_PX = 4;              // не реагировать на «дрожь»

export function createLetterWheel(container, callbacks = {}) {
  container.classList.add('wheel');
  container.innerHTML = '';

  // SVG для линии соединения. pointer-events:none — чтобы не перехватывать клики.
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('wheel-svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  polyline.setAttribute('fill', 'none');
  polyline.setAttribute('stroke', '#ffb84d');
  polyline.setAttribute('stroke-width', '2.5');
  polyline.setAttribute('stroke-linejoin', 'round');
  polyline.setAttribute('stroke-linecap', 'round');
  polyline.setAttribute('opacity', '0.85');
  svg.appendChild(polyline);
  container.appendChild(svg);

  let letters = [];       // строки 'К' и т.п.
  let letterEls = [];     // соответствующие DOM-элементы
  let positions = [];     // [{x, y}] в координатах контейнера (px)

  // === Размещение букв по окружности ===
  function layout() {
    const rect = container.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const radius = Math.min(rect.width, rect.height) * 0.30;
    positions = [];
    const n = letters.length;
    for (let i = 0; i < n; i++) {
      // Если букв 1 — в центр, иначе по окружности.
      if (n === 1) {
        positions.push({ x: cx, y: cy });
      } else {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        positions.push({
          x: cx + Math.cos(angle) * radius,
          y: cy + Math.sin(angle) * radius
        });
      }
    }
    // Применяем CSS.
    letterEls.forEach((el, i) => {
      const p = positions[i];
      el.style.left = `${p.x}px`;
      el.style.top  = `${p.y}px`;
    });
  }

  function rebuildLetters() {
    // Удалить старые буквы (svg сохраняем).
    letterEls.forEach(el => el.remove());
    letterEls = letters.map((ch, i) => {
      const el = document.createElement('div');
      el.className = 'wheel-letter';
      el.textContent = ch;
      el.dataset.index = String(i);
      container.appendChild(el);
      return el;
    });
    layout();
  }

  // === Состояние выделения ===
  let selectedIndices = [];   // массив индексов букв в порядке выбора
  let activePointerId = null;
  let startPoint = null;

  function currentWord() {
    return selectedIndices.map(i => letters[i]).join('');
  }

  function updateSelectionVisuals() {
    letterEls.forEach((el, i) => {
      el.classList.toggle('selected', selectedIndices.includes(i));
    });
    // Линия между выбранными.
    if (selectedIndices.length === 0) {
      polyline.setAttribute('points', '');
      return;
    }
    const rect = container.getBoundingClientRect();
    const pts = selectedIndices.map(i => {
      const p = positions[i];
      const x = (p.x / rect.width) * 100;
      const y = (p.y / rect.height) * 100;
      return `${x},${y}`;
    });
    polyline.setAttribute('points', pts.join(' '));
  }

  // Найти ближайшую букву под точкой (x, y в координатах контейнера).
  function pickLetter(x, y) {
    for (let i = 0; i < positions.length; i++) {
      const dx = x - positions[i].x;
      const dy = y - positions[i].y;
      if (dx * dx + dy * dy <= HIT_RADIUS_PX * HIT_RADIUS_PX) return i;
    }
    return -1;
  }

  function pointerToContainerCoords(ev) {
    const rect = container.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  }

  // === Обработчики ===
  function onPointerDown(ev) {
    if (activePointerId !== null) return;
    const { x, y } = pointerToContainerCoords(ev);
    const idx = pickLetter(x, y);
    if (idx === -1) return;            // тапнули в пустоту — игнор

    activePointerId = ev.pointerId;
    startPoint = { x: ev.clientX, y: ev.clientY };
    selectedIndices = [idx];
    container.setPointerCapture(ev.pointerId);
    updateSelectionVisuals();
    callbacks.onSelectionStart && callbacks.onSelectionStart();
    callbacks.onWordPreview && callbacks.onWordPreview(currentWord());
    ev.preventDefault();
  }

  function onPointerMove(ev) {
    if (ev.pointerId !== activePointerId) return;
    // Подавляем дрожь до начала движения.
    if (startPoint) {
      const dx = ev.clientX - startPoint.x;
      const dy = ev.clientY - startPoint.y;
      if (dx * dx + dy * dy < MIN_DRAG_PX * MIN_DRAG_PX) return;
    }
    const { x, y } = pointerToContainerCoords(ev);
    const idx = pickLetter(x, y);
    if (idx === -1) return;

    const last = selectedIndices[selectedIndices.length - 1];
    if (idx === last) return;
    // Возврат на предпоследнюю — отменяем последний шаг (как в word-connect играх).
    const prev = selectedIndices[selectedIndices.length - 2];
    if (idx === prev) {
      selectedIndices.pop();
      updateSelectionVisuals();
      callbacks.onWordPreview && callbacks.onWordPreview(currentWord());
      return;
    }
    if (selectedIndices.includes(idx)) return;       // нельзя один и тот же повторно
    selectedIndices.push(idx);
    updateSelectionVisuals();
    callbacks.onWordPreview && callbacks.onWordPreview(currentWord());
  }

  function onPointerUp(ev) {
    if (ev.pointerId !== activePointerId) return;
    const word = currentWord();
    activePointerId = null;
    startPoint = null;
    try { container.releasePointerCapture(ev.pointerId); } catch {}
    if (word.length >= 2) {
      callbacks.onWordSubmit && callbacks.onWordSubmit(word);
    }
    // Очищаем выделение чуть позже, чтобы анимация наверху не дёргалась.
    selectedIndices = [];
    updateSelectionVisuals();
  }

  function onPointerCancel(ev) {
    if (ev.pointerId !== activePointerId) return;
    activePointerId = null;
    startPoint = null;
    selectedIndices = [];
    updateSelectionVisuals();
  }

  container.addEventListener('pointerdown', onPointerDown);
  container.addEventListener('pointermove', onPointerMove);
  container.addEventListener('pointerup', onPointerUp);
  container.addEventListener('pointercancel', onPointerCancel);
  container.addEventListener('contextmenu', e => e.preventDefault()); // запрет long-press menu

  // Пересчёт позиций при resize.
  const onResize = () => layout();
  window.addEventListener('resize', onResize);

  // === Внешний API ===
  return {
    setLetters(arr) {
      letters = arr.map(s => String(s).toUpperCase());
      rebuildLetters();
    },
    shuffle() {
      // Перемешать массив letters и анимировать перетекание.
      const n = letters.length;
      for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [letters[i], letters[j]] = [letters[j], letters[i]];
      }
      // Обновим текст и позиции.
      letterEls.forEach((el, i) => { el.textContent = letters[i]; });
      layout();
    },
    reset() {
      selectedIndices = [];
      activePointerId = null;
      startPoint = null;
      updateSelectionVisuals();
    },
    shake() {
      container.classList.remove('shake');
      // reflow trick
      void container.offsetWidth;
      container.classList.add('shake');
      setTimeout(() => container.classList.remove('shake'), 500);
    },
    destroy() {
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('pointercancel', onPointerCancel);
      window.removeEventListener('resize', onResize);
      container.innerHTML = '';
    }
  };
}
