// main.js — bootstrap.
//
// Порядок:
//   1. Загружаем storage (это создаст дефолтное состояние при первом запуске).
//   2. Инициализируем audio (читает настройки звука из storage).
//   3. Инициализируем ads.
//   4. Если ?dev=1 — динамически грузим dev-панель.
//   5. Иначе — собираем массив уровней и запускаем игру.

import { CONFIG } from './config.js';
import * as storage from './storage.js';
import * as audio from './audio.js';
import * as ads from './ads.js';
import { HAND_CRAFTED_LEVELS } from './levels.js';

async function bootstrap() {
  storage.load();
  audio.initAudio();
  audio.primeOnFirstInteraction();
  await ads.initAds();

  const params = new URLSearchParams(location.search);
  const devMode = CONFIG.DEV.enabled && params.get('dev') === '1';

  const app = document.getElementById('app');
  app.innerHTML = ''; // убрать loading screen

  // HTML2APK:DEV_ONLY_BEGIN
  if (devMode) {
    try {
      const mod = await import('./devPanel.js');
      mod.mountDevPanel(app);
    } catch (err) {
      console.error('[main] failed to load dev panel:', err);
      app.innerHTML = `<div style="padding:24px;color:#fff">Не удалось загрузить dev-панель: ${err.message}</div>`;
    }
    return;
  }
  // HTML2APK:DEV_ONLY_END

  // Собираем массив уровней: ручные + сгенерированные.
  let levels = [...HAND_CRAFTED_LEVELS];
  try {
    const gen = await import('./levels.generated.js');
    if (gen && Array.isArray(gen.GENERATED_LEVELS)) {
      levels = [...levels, ...gen.GENERATED_LEVELS];
    }
  } catch {
    // Файла нет — это нормально на ранних этапах. Идём только с ручными.
  }

  const { mountGame } = await import('./ui.js');
  await mountGame(app, levels);
}

bootstrap().catch(err => {
  console.error('[main] bootstrap failed:', err);
  const app = document.getElementById('app');
  if (app) app.innerHTML = `<div style="padding:24px;color:#fff">Ошибка запуска: ${err.message}</div>`;
});
