# CLAUDE.md — 02_Words

## Preview-сервер: порт 8772

Этот проект — часть мульти-проектной мастерской из 4 параллельно ведущихся проектов
в `C:\Users\Александр\Desktop\Claude\`. У каждого закреплён **уникальный порт**,
чтобы preview-серверы могли работать одновременно и не перебивать друг друга.

### Карта портов мастерской

| Проект            | Порт  |
|-------------------|-------|
| 01_RS_GlitterSort | 8771  |
| 02_Words          | 8772  |
| 03_FlappyBird     | 8773  |
| 04_True-or-Do     | 8774  |

**Этот проект всегда работает на порту 8772.**

### Правила (важно для будущих сессий Claude)

- **НЕ меняй** значение `port` в `.claude/launch.json`. Оно зафиксировано намеренно.
- **НЕ ставь** `autoPort: true` — это приведёт к захвату соседнего порта другого проекта мастерской.
- **НЕ добавляй** альтернативные preview-конфигурации (`npx serve`, `npm run dev`, `http-server` и т.п.) на других портах. Если действительно нужен другой запуск — используй тот же порт 8772.
- Если 8772 «занят» — это, скорее всего, прежний инстанс **этого же** проекта. Останови его (`Get-Process python | Stop-Process`), а не переключайся на 8000/5173/8080 — это порты соседей.
- Эта мастерская специально разнесена по портам 8771–8774; не выходи за эти границы и не выбирай порт сам.

### Альтернативный запуск (вручную)

В этом проекте есть `scripts/dev_server.py` с no-cache заголовками. Если запускаешь его вручную — обязательно с явным портом 8772:

```
python scripts/dev_server.py 8772
```

Не используй его дефолт (8000) — это порт за пределами схемы мастерской.

## Монетизация: Yandex Mobile Ads (нативный SDK через WebView-bridge)

Проект целится в РуСтор APK. Реклама работает через **нативный Yandex Mobile Ads SDK**, который встраивается в APK инструментом `html2apk` (флаг `-YandexAdsBridge`). JS-сторона дёргает `window.YandexAds.showInterstitial(unitId)` / `showRewarded(unitId)` и слушает `window.__yandexAdsCallback(kind, event)`. В браузерном dev-режиме `window.YandexAds` отсутствует, и `js/ads.js` автоматически падает в mock с DOM-оверлеем.

**Полный контракт и Java-код моста:** [docs/ADS.md](docs/ADS.md).

### Unit-ID (Yandex Mobile Ads)

В [js/config.js](js/config.js), секция `CONFIG.ADS`:
- `unitInterstitial: 'R-M-19273487-1'`
- `unitRewarded:     'R-M-19273487-2'`

Источник: [Yandex Partner / Mobile Ads](https://partner.yandex.ru/mobile-ads).

### Что делает APK-сборщик

`html2apk -YandexAdsBridge -ProjectFolder <thisDir> -AppName "..." -AppId com.terekh.words -OutputFile <...>.apk` дополнительно встраивает gradle-зависимость, ACCESS_NETWORK_STATE, `YandexAdsBridge.java` и патчит MainActivity (см. CLAUDE.md соседнего 01_RS_GlitterSort, [docs/ADS.md](docs/ADS.md)).

### Правила (для будущих сессий)

- **НЕ возвращай** TODO под Yandex Games SDK (`/sdk.js`, `YaGames.init()`) — он для веб-публикации на yandex.com/games, не для APK в РуСтор.
- **НЕ подключай** `<script src="https://yandex.ru/ads/system/context.js">` — это РСЯ для веба, не нативный SDK.
- **НЕ убирай** mock-fallback из `detectBackend()` — он нужен для dev-режима в браузере.
- Контракт `window.__yandexAdsCallback(kind, event)` зафиксирован на стороне Java в html2apk — не меняй имя callback'а в JS.
- Точки вызова рекламы из gameplay (rewarded на подсказку, interstitial после уровня) — в [js/ui.js](js/ui.js). Не дублируй их в `ads.js`.

## Сейвы и миграции

Сейв хранится в `localStorage['02words_save']` как единый JSON c полем `schemaVersion`. При обновлении приложения [js/storage.js](js/storage.js) автоматически прогоняет старый сейв через каскад миграций из [js/migrations.js](js/migrations.js) до текущей версии. Полная спецификация — в [docs/SAVES.md](docs/SAVES.md).

### Правила (для будущих сессий)

- **Любое изменение формата сейва ОБЯЗАНО иметь миграцию.** Если ты добавляешь/переименовываешь/удаляешь поле в `DEFAULT_STATE` — обязательно добавь функцию в `migrations.js` (ключ N+1, где N — текущая `getCurrentSchemaVersion()`).
- **НЕ удаляй и НЕ меняй уже опубликованные миграции.** У живых юзеров сейвы на этих схемах. Меняй только последнюю миграцию до публикации; в сторе уже — добавляй сверху новую.
- **НЕ дублируй CURRENT_SCHEMA_VERSION константой** — она авто-выводится из `max(keys(migrations))`.
- **При запросе релиз-кандидата** используй skill `prepare-release-candidate` — он сам проверит миграции, прогонит self-test и запустит `html2apk -Release`.
- Состояние последнего опубликованного релиза — `.claude/release-state.json`. Обновляется автоматически skill'ом `prepare-release-candidate` — после сборки APK он спрашивает «отправляешь в стор?», и при ответе «да» записывает текущую `schemaVersion`/`versionCode`/`versionName` в файл.
