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
import * as rustoreReview from './rustoreReview.js';
import * as pushScheduler from './pushScheduler.js';
import { PUSH_TEMPLATES } from './pushTemplates.js';
import * as analytics from './analytics.js';
import { HAND_CRAFTED_LEVELS } from './levels.js';
import { configure as rcConfigure, initRemoteConfig, rcCohorts } from './remote/remoteConfig.js';
import rcDeclaration from './remote/declaration.js';
import { cohortLabel } from './remote/progress.js';

async function bootstrap() {
  storage.load();
  audio.initAudio();
  audio.primeOnFirstInteraction();
  await ads.initAds();
  // RuStore in-app review bridge: регистрируем appId для fallback на deep-link
  // и запускаем eager preload reviewInfo. Без preload первый launch() висит
  // 1-2 сек на сетевой запрос; preload делает показ диалога мгновенным.
  rustoreReview.configure('com.terekh.words');

  // AppMetrica analytics: configure до первого event() — иначе userId не
  // подтянется к нативному bridge'у. Сам bridge инжектится через html2apk
  // -YandexAppMetrica, AppMetrica.activate() уже сработал в MainActivity.
  // onCreate ДО bootstrap'а — здесь мы только цепляем JS-обёртку и шлём
  // session_start как маркер (auto-tracked app_open уже улетел).
  analytics.configure({
    appName: 'words',
    appVersion: '1.0.0',
    userId: storage.getUserId()
  });
  // Экспортируем в window — для доступа из ui.js через global.
  window.Analytics = analytics;

  // Удалённая конфигурация (общий модуль ../admin). Объявление СИНХРОННО и до
  // всего остального: с этой секунды tuned() отдаёт значения сборки, даже
  // если сети нет вовсе.
  rcConfigure(rcDeclaration);

  // Загрузка НЕ блокирует первый экран: конфиг нужен между уровнями, а это
  // минутами позже. У модуля свой таймаут 4 с — ждать сеть дольше игрок не
  // должен.
  //
  // SESSION_START ЖДЁТ ГРУППУ. Событие, ушедшее до ответа сети, уходит без
  // параметра `ab` — и тогда верх воронки размечен хуже низа, а доли по шагам
  // перестают быть конверсией. Цена — потерянный session_start у того, кто
  // закрыл игру в первые секунды; это меньшее искажение, чем неразмеченные
  // группы во всех сессиях подряд.
  initRemoteConfig({
    appId: 'com.terekh.words',
    versionBase: '1.0',
    // Тот же идентификатор, что в аналитике: из него считаются группы A/B,
    // поэтому жребий не меняется от запуска к запуску.
    installId: storage.getUserId()
  }).then(() => {
    // `cohortLabel`, а не `join`: вне тестов нужна метка `default`. Пустая
    // строка означала бы «конфиг ещё не доехал», а это другое.
    analytics.setAbCohorts(cohortLabel(rcCohorts()));
  }).catch(() => {
    /* нет сети — играем на значениях сборки, это штатно */
  }).then(() => {
    analytics.event('session_start');
  });

  // Push-уведомления (Local Notifications). Источник правды enabled —
  // Storage.getPushEnabled / setPushEnabled. Прокидываем их в pushScheduler
  // через getEnabled/setEnabled, чтобы scheduler читал/писал в наш storage,
  // а не в свой собственный ключ.
  pushScheduler.configure({
    appName: 'Слова',
    templates: PUSH_TEMPLATES,
    maxPerDay: 4,
    storageKey: 'words_push_schedule',
    getEnabled: storage.getPushEnabled,
    setEnabled: storage.setPushEnabled
  });
  // Экспортируем в window для доступа из ui.js (модулярный код там, проще
  // через global чем через import-chain).
  window.PushScheduler = pushScheduler;
  // Permission запрашиваем СРАЗУ при первом запуске приложения
  // (pushPermissionAsked === false). См. SKILL connect-local-notifications.
  if (!storage.getPushPermissionAsked() && storage.getPushEnabled()) {
    storage.setPushPermissionAsked(true);
    setTimeout(() => {
      pushScheduler.requestPermission().then(result => {
        console.log('[push] permission result:', result);
        if (result === 'granted') pushScheduler.refresh();
      });
    }, 800);
  } else if (pushScheduler.getPermissionState() === 'granted'
             && storage.getPushEnabled()) {
    pushScheduler.refresh();
  }

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
