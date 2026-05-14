// cheatPanel.js — внутриигровая чит-панель для разработчика/тестера.
//
// Активация: 5 быстрых тапов по «Уровень N» в верхнем баре (см. ui.js).
//
// Открывает оверлей с действиями: переход на уровень, завершение текущего,
// сброс прогресса, добавление подсказок, переключение mock-рекламы.

import { CONFIG } from './config.js';
import * as storage from './storage.js';

// Подписки, которые установит ui.js — чтобы панель могла дёрнуть «загрузить уровень N»
// без знания внутренней структуры UI.
const hooks = {
  onJumpTo: null,        // (idx: number) => void
  onCompleteLevel: null, // () => void
  totalLevels: 50
};

export function setHooks(h) { Object.assign(hooks, h); }

export function showCheatPanel() {
  // Если уже открыта — не дублируем.
  if (document.getElementById('cheat-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'cheat-overlay';
  overlay.className = 'dialog';
  overlay.innerHTML = `
    <div class="dialog-card" style="max-width:340px;text-align:left">
      <h3 style="margin:0 0 12px">🎮 Чит-панель</h3>
      <div style="margin-bottom:14px;color:#555;font-size:13px">
        Текущий уровень: <b id="ct-cur">${storage.getCurrentLevel() + 1}</b>
        · подсказок: <b id="ct-hints">${storage.getHints()}</b>
        · пройдено: <b id="ct-done">${storage.getState().completedLevels.length}</b>
      </div>

      <div style="margin-bottom:10px">
        <label style="font-size:12px;color:#666">Перейти на уровень (1-${hooks.totalLevels})</label>
        <div style="display:flex;gap:6px;margin-top:4px">
          <input id="ct-jump-input" type="number" min="1" max="${hooks.totalLevels}" value="${storage.getCurrentLevel() + 1}" style="flex:1;padding:8px;border:1px solid #ccc;border-radius:6px">
          <button id="ct-jump" class="primary" style="padding:8px 14px;border-radius:6px;background:#4a9eff;color:#fff;font-weight:600">Go</button>
        </div>
        <div style="display:flex;gap:6px;margin-top:6px">
          <button id="ct-prev" style="flex:1;padding:8px;border-radius:6px;background:#e8eef7;color:#2a3f5f;font-weight:600">← Предыдущий</button>
          <button id="ct-next" style="flex:1;padding:8px;border-radius:6px;background:#e8eef7;color:#2a3f5f;font-weight:600">Следующий →</button>
        </div>
      </div>

      <div style="border-top:1px solid #eee;padding-top:10px;margin-bottom:10px">
        <button id="ct-skip" style="width:100%;padding:10px;border-radius:8px;background:#ffb84d;color:#4a2e00;font-weight:700">✓ Завершить текущий уровень</button>
      </div>

      <div style="border-top:1px solid #eee;padding-top:10px;margin-bottom:10px">
        <div style="display:flex;gap:6px;margin-bottom:6px">
          <button id="ct-add-hints" style="flex:1;padding:8px;border-radius:6px;background:#2a8c52;color:#fff;font-weight:600">+10 подсказок</button>
          <button id="ct-99-hints" style="flex:1;padding:8px;border-radius:6px;background:#2a8c52;color:#fff;font-weight:600">Подсказок = 99</button>
        </div>
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer">
          <input id="ct-mock-ads" type="checkbox" ${CONFIG.ADS.useMock ? 'checked' : ''}>
          Mock-реклама (если убрать — попробует Яндекс SDK)
        </label>
      </div>

      <div style="border-top:1px solid #eee;padding-top:10px;margin-bottom:10px">
        <button id="ct-reset" style="width:100%;padding:10px;border-radius:8px;background:#c44;color:#fff;font-weight:600">⚠ Сбросить весь прогресс</button>
      </div>

      <div style="border-top:1px solid #eee;padding-top:10px">
        <button id="ct-close" style="width:100%;padding:10px;border-radius:8px;background:#eee;color:#333;font-weight:600">Закрыть</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const refresh = () => {
    overlay.querySelector('#ct-cur').textContent = String(storage.getCurrentLevel() + 1);
    overlay.querySelector('#ct-hints').textContent = String(storage.getHints());
    overlay.querySelector('#ct-done').textContent = String(storage.getState().completedLevels.length);
  };

  function close() { overlay.remove(); }

  overlay.querySelector('#ct-close').addEventListener('click', close);

  overlay.querySelector('#ct-jump').addEventListener('click', () => {
    const v = parseInt(overlay.querySelector('#ct-jump-input').value, 10);
    if (!v || v < 1 || v > hooks.totalLevels) { alert('Неверный номер.'); return; }
    close();
    hooks.onJumpTo && hooks.onJumpTo(v - 1);
  });

  overlay.querySelector('#ct-prev').addEventListener('click', () => {
    const idx = Math.max(0, storage.getCurrentLevel() - 1);
    close();
    hooks.onJumpTo && hooks.onJumpTo(idx);
  });

  overlay.querySelector('#ct-next').addEventListener('click', () => {
    const idx = Math.min(hooks.totalLevels - 1, storage.getCurrentLevel() + 1);
    close();
    hooks.onJumpTo && hooks.onJumpTo(idx);
  });

  overlay.querySelector('#ct-skip').addEventListener('click', () => {
    close();
    hooks.onCompleteLevel && hooks.onCompleteLevel();
  });

  overlay.querySelector('#ct-add-hints').addEventListener('click', () => {
    storage.addHints(10);
    refresh();
  });

  overlay.querySelector('#ct-99-hints').addEventListener('click', () => {
    const cur = storage.getHints();
    storage.addHints(Math.max(0, 99 - cur));
    refresh();
  });

  overlay.querySelector('#ct-mock-ads').addEventListener('change', (ev) => {
    CONFIG.ADS.useMock = ev.target.checked;
    // Переключение требует перезагрузки модуля ads (адаптер выбирается при импорте).
    alert(CONFIG.ADS.useMock
      ? 'Включена mock-реклама. Эффект — после перезагрузки страницы.'
      : 'Mock отключён. Подключите Yandex SDK и перезагрузите страницу.');
  });

  overlay.querySelector('#ct-reset').addEventListener('click', () => {
    if (!confirm('Точно сбросить весь прогресс?')) return;
    storage.reset();
    close();
    hooks.onJumpTo && hooks.onJumpTo(0);
  });
}

// Хелпер: повесить детектор 5-кратного тапа на элемент.
// При срабатывании — вызывает callback (например, showCheatPanel).
export function attachSecretTap(el, callback, requiredTaps = null, windowMs = 1500) {
  const required = requiredTaps || CONFIG.DEV.secretTapsToOpen || 5;
  let taps = 0;
  let lastTap = 0;
  el.addEventListener('click', () => {
    const now = Date.now();
    if (now - lastTap > windowMs) taps = 0;
    taps++;
    lastTap = now;
    if (taps >= required) {
      taps = 0;
      callback();
    }
  });
}
