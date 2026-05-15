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
  // Пример будущей миграции:
  // 2: (state) => {
  //   // v1 → v2: добавили поле `coins`, дефолт 0
  //   if (state.coins === undefined) state.coins = 0;
  //   return state;
  // },
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
