// migrations.js — реестр миграций сейва. См. docs/SAVES.md.
//
// Контракт:
//   migrations[N]: state v(N-1) → state vN  (чистая функция, без сайд-эффектов)
//   getCurrentSchemaVersion() — авто-вывод из max(keys), не дублируем константу
//   runMigrations(state, fromVersion) — каскад от fromVersion до текущей
//
// ⚠️ ПРАВИЛО: после публикации релиза НЕ меняй существующую миграцию —
// у живых юзеров уже могут быть сейвы на этой схеме. Меняй только текущую
// (последнюю) до публикации. Если миграция сломана уже в сторе — добавляй
// новую миграцию N+1, фиксящую ошибку.

export const migrations = {
  1: (state) => {
    // v0 → v1: первая миграция этой системы. Чистим legacy-поле `version`
    // (так в раннем 02_Words storage'е назывался schema marker), переносим
    // его значение в `schemaVersion` если есть. После — это поле всегда
    // `schemaVersion`.
    if ('version' in state) delete state.version;
    return state;
  },
  2: (state) => {
    // v1 → v2: добавлены поля push-уведомлений.
    //   pushEnabled — toggle в Settings. По умолчанию true. Без permission
    //                 всё равно ничего не показывается — безопасно.
    //   pushPermissionAsked — флаг что мы уже запрашивали Android-permission,
    //                         чтобы не доставать юзера повторно при каждом win.
    if (typeof state.pushEnabled !== 'boolean') state.pushEnabled = true;
    if (typeof state.pushPermissionAsked !== 'boolean') state.pushPermissionAsked = false;
    return state;
  },
  3: (state) => {
    // v2 → v3: добавлен userId для аналитики AppMetrica.
    //   UUID v4 (crypto.randomUUID на WebView 92+ / Android 8+), fallback
    //   на pseudo-UUID на старых устройствах. Один раз — на всю жизнь
    //   установки. Юзер при чистке данных приложения получит новый ID
    //   (новый юзер с точки зрения аналитики).
    if (!state.userId) {
      state.userId = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'u-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    }
    return state;
  },
  4: (state) => {
    // v3 → v4: стартовый запас подсказок стал ключом конфига (`hints_start`),
    // и его правка применяется ОДИН раз — отсюда флаг.
    //
    // Тем, кто уже играет, ставим `true`: свои стартовые подсказки они получили
    // при установке, и поправка на разницу с бакетом отняла бы у них запас
    // посреди игры. `false` бывает только у сейва из DEFAULT_STATE, то есть у
    // настоящего нового игрока. Зачем это вообще — `applyStartGrant` в
    // `js/storage.js`.
    if (typeof state.startAdjusted !== 'boolean') state.startAdjusted = true;
    return state;
  },
};

export function getCurrentSchemaVersion() {
  const keys = Object.keys(migrations).map(Number);
  return keys.length ? Math.max(...keys) : 1;
}

export function runMigrations(state, fromVersion) {
  const current = getCurrentSchemaVersion();
  let v = (typeof fromVersion === 'number') ? fromVersion : 0;
  while (v < current) {
    const fn = migrations[v + 1];
    if (typeof fn !== 'function') {
      throw new Error(`[migrations] Missing migration ${v + 1} (target schemaVersion=${current})`);
    }
    state = fn(state);
    v++;
  }
  return { state, schemaVersion: current };
}
