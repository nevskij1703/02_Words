// settings.js — окно настроек (звук, тема, политика конфиденциальности).
//
// Открывается по тапу на кнопку «Настройки» в верхнем баре. Содержит:
//   • тогл звука           — обёртка над audio.toggle();
//   • тогл темы            — light/dark, обёртка над applyTheme + storage;
//   • текстовая ссылка     — открывает страницу политики конфиденциальности
//                             во внешнем браузере (через window.open _blank).
//
// Контракт showSettingsDialog({ audio, storage, applyTheme }):
//   - audio       — модуль js/audio.js (isEnabled / toggle / play).
//   - storage     — модуль js/storage.js (getSettings / setSetting).
//   - applyTheme  — функция из ui.js: применяет тему к DOM и сохраняет.
//                   (Локальна для mountGame closure, поэтому пробрасываем.)
//
// URL политики зафиксирован в одном месте — PRIVACY_URL ниже. Если когда-то
// сменим хостинг (Yandex Disk → Google Drive и т.п.), правим только здесь.

const PRIVACY_URL = 'https://cloud.mail.ru/public/3PaG/kcZCUtPur';

export function showSettingsDialog({ audio, storage, applyTheme }) {
  // Если уже открыто — не дублируем (например, повторный тап по кнопке).
  if (document.getElementById('settings-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'settings-overlay';
  overlay.className = 'dialog';

  const soundOn = audio.isEnabled();
  const themeDark = (storage.getSettings().theme === 'dark');
  // Уведомления: «вкл» если pushEnabled И permission не denied. Если юзер
  // отказал в системном dialog — показываем off.
  const pushScheduler = window.PushScheduler;
  const notifOn = storage.getPushEnabled()
                  && (!pushScheduler || pushScheduler.getPermissionState() !== 'denied');

  overlay.innerHTML = `
    <div class="dialog-card settings-card">
      <h3 class="settings-title">Настройки</h3>

      <div class="settings-row">
        <span class="settings-label">Звук</span>
        <button class="settings-toggle" id="set-sound" role="switch"
                aria-checked="${soundOn}" data-on="${soundOn}">
          <span class="settings-toggle-thumb"></span>
        </button>
      </div>

      <div class="settings-row">
        <span class="settings-label">Тёмная тема</span>
        <button class="settings-toggle" id="set-theme" role="switch"
                aria-checked="${themeDark}" data-on="${themeDark}">
          <span class="settings-toggle-thumb"></span>
        </button>
      </div>

      <div class="settings-row">
        <span class="settings-label">Уведомления</span>
        <button class="settings-toggle" id="set-notifications" role="switch"
                aria-checked="${notifOn}" data-on="${notifOn}">
          <span class="settings-toggle-thumb"></span>
        </button>
      </div>

      <button class="settings-privacy" id="set-privacy" type="button">
        Политика конфиденциальности
      </button>

      <button class="settings-close" id="set-close" type="button">Готово</button>
    </div>
  `;
  document.body.appendChild(overlay);

  const soundBtn   = overlay.querySelector('#set-sound');
  const themeBtn   = overlay.querySelector('#set-theme');
  const notifBtn   = overlay.querySelector('#set-notifications');
  const privacyBtn = overlay.querySelector('#set-privacy');
  const closeBtn   = overlay.querySelector('#set-close');

  // Внутренняя утилита — отразить состояние тогла в DOM.
  const setToggleState = (el, on) => {
    el.dataset.on = String(on);
    el.setAttribute('aria-checked', String(on));
  };

  soundBtn.addEventListener('click', () => {
    const on = audio.toggle();
    setToggleState(soundBtn, on);
    // Маленький щелчок при включении (а при выключении уже не услышим).
    if (on) audio.play('click');
  });

  themeBtn.addEventListener('click', () => {
    const next = themeBtn.dataset.on === 'true' ? 'light' : 'dark';
    storage.setSetting('theme', next);
    applyTheme(next);
    setToggleState(themeBtn, next === 'dark');
    audio.play('click');
  });

  // Уведомления: пишем в Storage.pushEnabled, при включении — permission
  // request если ещё не давали. При отказе — toggle обратно в off.
  if (notifBtn) {
    notifBtn.addEventListener('click', () => {
      const newOn = notifBtn.dataset.on !== 'true';
      storage.setPushEnabled(newOn);
      setToggleState(notifBtn, newOn);
      audio.play('click');
      if (newOn) {
        const ps = window.PushScheduler;
        if (ps && ps.getPermissionState() !== 'granted') {
          storage.setPushPermissionAsked(true);
          ps.requestPermission().then((result) => {
            if (result === 'granted') ps.refresh();
            else {
              storage.setPushEnabled(false);
              setToggleState(notifBtn, false);
            }
          });
        } else if (ps) {
          ps.refresh();
        }
      } else {
        if (window.LocalNotifications && window.LocalNotifications.cancelAll) {
          try { window.LocalNotifications.cancelAll(); } catch (e) {}
        }
      }
    });
  }

  privacyBtn.addEventListener('click', () => {
    // _blank — в браузере открывает новую вкладку; в WebView APK Android
    // переадресует на ACTION_VIEW intent → откроется во внешнем браузере.
    // noopener — стандартная защита.
    try { window.open(PRIVACY_URL, '_blank', 'noopener'); }
    catch (e) { console.warn('[settings] privacy open failed', e); }
  });

  // Закрытие по кнопке «Готово» и по клику на полупрозрачный фон.
  const close = () => overlay.remove();
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (ev) => {
    // Кликаем именно по фону (не по карточке).
    if (ev.target === overlay) close();
  });
}
