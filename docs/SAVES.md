# Сейв и миграции (02_Words)

## Структура

LocalStorage-ключ: `02words_save`. Под ним лежит единый JSON:

```json
{
  "schemaVersion": 1,
  "currentLevel": 4,
  "completedLevels": [...],
  "hints": 5,
  "foundBonusByLevel": {...},
  "revealedCellsByLevel": {...},
  "stats": { "levelsCompleted": 4, "wordsFound": 23 },
  "settings": { "sound": true, "vibration": true }
}
```

`schemaVersion` — версия структуры сейва. Растёт **только** когда меняется формат `data`-полей. Не связана с `versionName` приложения.

## Контракт

- [js/storage.js](../js/storage.js) при `load()` читает сейв, определяет `fromVersion` (поддерживает legacy-имя `version`), прогоняет через `runMigrations()` каскадно от `fromVersion` до `getCurrentSchemaVersion()`.
- [js/migrations.js](../js/migrations.js) — реестр миграций. Каждая миграция — чистая функция `(state) => state`.
- `CURRENT_SCHEMA_VERSION` авто-выводится из `max(keys(migrations))`. Не дублируется константой.

## Как добавить новую миграцию

1. В коде поменялся формат сейва (добавили/переименовали/удалили поле). До этой правки `getCurrentSchemaVersion()` возвращал, например, 3.
2. В `js/migrations.js` добавь функцию `4: (state) => { /* v3 → v4 transform */ return state; }`.
3. Обнови `DEFAULT_STATE` в `js/storage.js` — там должна быть новая структура.
4. После публикации в РуСтор обнови `.claude/release-state.json` (`lastPublishedSchemaVersion: 4`).

## ⚠️ Правила

- **Не меняй уже опубликованную миграцию.** У живых юзеров уже сейвы на этой схеме. Меняй только текущую (последнюю) до публикации. Если миграция сломана в сторе — добавь новую миграцию `N+1` сверху, фиксящую ошибку.
- **Миграции должны быть defensive** — используй `?? defaultValue` для отсутствующих полей.
- **Каскадные миграции** обрабатывают юзеров с любой исторической версией. Каждая функция запускается ровно один раз.

## Проверка перед релизом

Skill `prepare-release-candidate` перед сборкой запускает **полный self-test**: пустой сейв прогоняется через **все** миграции в реестре, проверяется что результат имеет правильный `schemaVersion` и не выбрасывает исключений. Если что-то падает — сборка релиза не запускается.

## Опубликованный релиз

`.claude/release-state.json`:

```json
{
  "lastPublishedSchemaVersion": 3,
  "lastPublishedVersionCode": 716421,
  "lastPublishedVersionName": "1.0.0.202601151230",
  "lastPublishedAt": "2026-01-15T12:30:00Z"
}
```

Обновляется **автоматически** skill'ом `prepare-release-candidate` после того, как пользователь подтвердил, что отправляет собранный APK в стор. Если не подтвердил — файл остаётся как был, и при следующем RC сравнение идёт с той же базой.
