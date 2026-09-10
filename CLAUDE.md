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
- `unitInterstitial: 'R-M-19273571-1'`
- `unitRewarded:     'R-M-19273571-2'`

Источник: [Yandex Partner / Mobile Ads](https://partner.yandex.ru/mobile-ads).

### Что делает APK-сборщик

Флаг `-YandexAdsBridge` передавать руками **не нужно и не надо**: он берётся из
`"yandexAdsBridge": true` в `.claude/build-config.json`. Источник правды один —
конфиг. Руками флаг терялся молча: команду копируют, забывают флаг, и сборка
уезжает в стор без монетизации при полностью рабочем рекламном коде в JS. Гейт
пяти обязательных SDK в `prepare-release-candidate` смотрит тоже в конфиг.

Сборка (`html2apk -ProjectFolder <thisDir> -OutputFile <...>.apk`) с этим флагом
встраивает gradle-зависимость, ACCESS_NETWORK_STATE, `YandexAdsBridge.java` и патчит MainActivity (см. CLAUDE.md соседнего 01_RS_GlitterSort, [docs/ADS.md](docs/ADS.md)).

### Правила (для будущих сессий)

- **Интерстишиалы намеренно выключены** (`CONFIG.ADS.interstitialEnabled: false`, с 2026-05-27): игроки жаловались в отзывах, доход мизерный против rewarded. Это НЕ баг — не «чини» отсутствие рекламы между уровнями. Включается обратно одним флагом, расписание сохранено. Подробности — в [docs/ADS.md](docs/ADS.md).
- **НЕ возвращай** TODO под Yandex Games SDK (`/sdk.js`, `YaGames.init()`) — он для веб-публикации на yandex.com/games, не для APK в РуСтор.
- **НЕ подключай** `<script src="https://yandex.ru/ads/system/context.js">` — это РСЯ для веба, не нативный SDK.
- **НЕ убирай** mock-fallback из `detectBackend()` — он нужен для dev-режима в браузере.
- Контракт `window.__yandexAdsCallback(kind, event)` зафиксирован на стороне Java в html2apk — не меняй имя callback'а в JS.
- Точки вызова рекламы из gameplay (rewarded на подсказку, interstitial после уровня) — в [js/ui.js](js/ui.js). Не дублируй их в `ads.js`.

## In-App оценка: RuStore Review SDK

Кнопка «Оценить» в модалке «Спасибо за помощь» вызывает **нативный диалог RuStore Review** поверх WebView (юзер ставит звёзды без выхода из игры). Подключено через bridge `window.RuStoreReview.launch()` / `__rustoreReviewCallback`, реализованный в html2apk при флаге `-RuStoreReviewSdk`. JS-обёртка — [js/rustoreReview.js](js/rustoreReview.js). Полная архитектура и контракт — в skill [`connect-rustore-review`](~/.claude/skills/connect-rustore-review/SKILL.md).

**Fallback policy:**
- Bridge нет (browser dev / APK без `-RuStoreReviewSdk`) → сразу `window.open('https://www.rustore.ru/catalog/app/com.terekh.words')`.
- SDK вернул `'unavailable'` (нет RuStore на устройстве / устарел) → fallback на тот же deep-link.
- SDK вернул `'failed'` (`RuStoreReviewExists` / `RuStoreRequestLimitReached` / `Unauthorized` / `InvalidReviewInfo`) → silent, ничего не показываем. Это нормальный отказ SDK, спамить юзера deep-link'ом тут нельзя.

### Правила (для будущих сессий)

- **НЕ возвращай** `window.open('https://www.rustore.ru/catalog/app/...')` напрямую в обработчик клика «Оценить» — теперь deep-link живёт только как fallback внутри `js/rustoreReview.js`.
- **НЕ меняй** имя callback'а `__rustoreReviewCallback` — оно зашито в Java-bridge'е (`RuStoreReviewBridge.java`).
- **НЕ удаляй** флаг `"rustoreReviewSdk": true` из `.claude/build-config.json` — без него html2apk не подключит SDK в APK, и `window.RuStoreReview` будет undefined.
- `configure('com.terekh.words')` вызывается один раз в [js/main.js](js/main.js) при bootstrap — eager preload даёт мгновенный показ при первом клике «Оценить».

## Сейвы и миграции

Сейв хранится в `localStorage['02words_save']` как единый JSON c полем `schemaVersion`. При обновлении приложения [js/storage.js](js/storage.js) автоматически прогоняет старый сейв через каскад миграций из [js/migrations.js](js/migrations.js) до текущей версии. Полная спецификация — в [docs/SAVES.md](docs/SAVES.md).

### Правила (для будущих сессий)

- **Любое изменение формата сейва ОБЯЗАНО иметь миграцию.** Если ты добавляешь/переименовываешь/удаляешь поле в `DEFAULT_STATE` — обязательно добавь функцию в `migrations.js` (ключ N+1, где N — текущая `getCurrentSchemaVersion()`).
- **НЕ удаляй и НЕ меняй уже опубликованные миграции.** У живых юзеров сейвы на этих схемах. Меняй только последнюю миграцию до публикации; в сторе уже — добавляй сверху новую.
- **НЕ дублируй CURRENT_SCHEMA_VERSION константой** — она авто-выводится из `max(keys(migrations))`.
- **При запросе релиз-кандидата** используй skill `prepare-release-candidate` — он сам проверит миграции, прогонит self-test и запустит `html2apk -Release`.
- Состояние последнего опубликованного релиза — `.claude/release-state.json`. Обновляется автоматически skill'ом `prepare-release-candidate` — после сборки APK он спрашивает «отправляешь в стор?», и при ответе «да» записывает текущую `schemaVersion`/`versionCode`/`versionName` в файл.

## Аналитика: Yandex AppMetrica

Проект использует **Yandex AppMetrica SDK** (бесплатная аналитика без сервера). Подключено через `-YandexAppMetrica` html2apk-flag (см. skill `~/.claude/skills/connect-appmetrica/SKILL.md`).

**API key**: `5f0e9cf4-3c7e-4b73-b80d-d261a6b96ebf` (в `.claude/build-config.json` → `appMetricaApiKey`).

**JS-обёртка**: [js/analytics.js](js/analytics.js) (ES-module). Экспортируется в `window.Analytics` из [js/main.js](js/main.js) для доступа из ui.js без import-цепочек.

**Карта событий** + где смотреть в дашборде — [docs/ANALYTICS.md](docs/ANALYTICS.md).

### Минимальный список событий (этого проекта)

- `session_start` — bootstrap (main.js)
- `level_start` — начало уровня (ui.js → loadLevel)
- `level_complete` — победа (ui.js → handleGameEvent)
- `word_found` `{word_length, is_bonus}` — каждое найденное слово (ui.js → word-main/word-bonus)
- `hint_used` — использована подсказка (ui.js → hint event)
- `ad_interstitial_shown` `{placement}` — перед показом interstitial
- `ad_rewarded_shown` `{placement, watched, reward_given}` — после rewarded callback
- `settings_opened` — открытие settings modal

### Правила (для будущих сессий)

- **НЕ дублируй имена событий** из общей таксономии (`session_start`, `level_start`, `level_complete`, `ad_interstitial_shown`, `ad_rewarded_shown`, `hint_used`, `settings_opened`). Они должны совпадать one-to-one во всех 4 проектах мастерской.
- **НЕ меняй имена опубликованных событий** — сломаешь воронки/retention в дашборде у живых юзеров.
- **НЕ шли PII** (имя, email, точная геолокация, IP) в event params — нарушение Privacy Policy и политики AppMetrica.
- **НЕ добавляй analyticsEnabled toggle** — выбран авто-вкл без UI-настройки (см. PRIVACY_POLICY.md, секцию AppMetrica).
- **userId** генерируется один раз при первой загрузке (`Storage.getUserId()` — UUID v4 через `crypto.randomUUID()` или pseudo-UUID fallback). Стабилен между сессиями, теряется при чистке данных приложения.
- **НЕ меняй имя bridge'а** `window.AppMetrica` — оно зашито в `AppMetricaBridge.java` через `addJavascriptInterface(..., "AppMetrica")`.
- При добавлении новых событий — обязательно обнови [docs/ANALYTICS.md](docs/ANALYTICS.md).

## Игра подчиняется админке (`../admin`)

`RuStore-games/admin/` — **отдельный репозиторий**, общий для всех личных игр.
Отсюда берутся удалённая конфигурация, A/B-тесты и вся аналитика в одном месте.
Короткая инструкция — **[admin/docs/FOR_GAMES.md](../admin/docs/FOR_GAMES.md)**:
что админка читает у игры, что менять при изменениях и на что она НЕ смотрит.

### Что это меняет в работе здесь

**Часть чисел игры больше не только в коде.** Главный выключатель межстраничной
(`interstitial_enabled` — формат выключен с 27.05.2026, и включить его обратно
теперь можно без сборки), её порог и кулдаун, награда за ролик
(`hints_per_rewarded`), потолок пополнения (`hints_refill_cap`), порог кнопки
подсказки и момент просьбы об оценке. Значение приезжает из файла в облаке и
меняется **без выпуска обновления**.

- Объявление — **[`remote-config.json`](remote-config.json)** в корне игры:
  `defaults` (обязаны совпадать с константами сборки), `ranges` (ключ без рамки
  игра не применит вовсе), `labels` (подписи в админке), `funnel` (шаги
  воронки).
- Значения, которые сейчас у игроков —
  `admin/cloud/config/com.terekh.words.json`. Правка файла без заливки
  (`cloud/config-push.ps1`) не меняет ничего.
- Читать значения — только через `tuned()` из [`js/tuning.js`](js/tuning.js) и
  **при обращении**, а не в константу при старте: иначе значение застынет и
  правка в облаке не подействует до перезапуска.

**Дефолты живут здесь, в игре.** Пустой, недоступный или битый конфиг обязан
означать «игра работает как была». Сервер только перебивает значения. Константы
в [`js/config.js`](js/config.js) остаются резервом: `tuned()` берёт их, когда
конфига нет. **Не убирай их** — dev-панель и браузерный прогон логики
`configure()` не зовут вовсе.

**Конфиги приурочены к версиям.** `versionBase` в
[`.claude/build-config.json`](.claude/build-config.json) (сейчас `1.0`) — это
ключ слоя `byVersion`: им новой сборке дают одни значения, а выпущенной
оставляют прежние. Поднимаешь мажор или минор — новый слой в админке появится
сам. Со `versionName` из магазина (`1.0.0.202605241653`) это **разные
пространства имён**, сводить их нельзя.

**Группы A/B уходят в аналитику.** `analytics.setAbCohorts()` зовётся после
загрузки конфига, и метка уходит параметром `ab` в каждом событии.
`session_start` намеренно ЖДЁТ группу — иначе верх воронки размечен хуже низа.
Без этого тест бессмыслен: разбиение есть, а сравнить группы нечем.

**Прохождение и группа A/B — в ОДНОМ параметре одного события.** `level_start` в
`js/ui.js` отправляет рядом с плоским `level_num` ещё и вложенный `progress: {
"<уровень>": "<группа>" }`.

Вложенный — не для красоты. В дереве параметров отчёта уровень и группа тогда
лежат на разных уровнях ОДНОЙ ветви и пересекаются запросом
(`paramsLevel2`+`paramsLevel3`); лежа соседними ветвями — то есть `level_num` и
`ab` просто рядом — они не пересекаются, и такой запрос отдаёт ноль строк.
Проверено на живых данных.

Форму собирает `progressParams()` из общего клиента: один код на игру и на
админку, иначе запрос не нашёл бы данные. Вне тестов группа называется
`default`, а не пустой строкой — пустое значение в отчёте неотличимо от
«параметра не было».

Плоский `level_num` остаётся на месте: только он есть у выпущенных сборок, и
панель прохождения умеет читать обе формы. Отдельных событий `level_<N>_done`
больше нет — они были следствием неверной посылки, будто разрез по параметру
недостижим в принципе.

### Что нужно обновить в админке, если правишь игру

Админка **не разбирает код игры** — она знает только то, что написано в
`remote-config.json` и `.claude/build-config.json`. Поэтому:

| в игре поменялось | что сделать в `../admin` |
|---|---|
| новое число, которое хочется крутить из облака | ключ в `remote-config.json` (+`ranges`!), затем в `cloud/config/com.terekh.words.json` со значением константы сборки |
| ключ переименован или убран | поправить оба файла, иначе в бакете останется значение, которое игра молча отбрасывает |
| поменялось событие или параметр прохождения | `funnel.levels` (`event` / `param` / `max`) — по нему рисуется график |
| поднят мажор/минор | `versionBase` в `.claude/build-config.json` |
| просят «завести A/B-тест» | **тест не пишется в код игры.** Он заводится в админке (вкладка «Ремоут») или в `cloud/config/com.terekh.words.json`; от игры нужно только объявленный ключ. Значения группы приходят поверх общих сами |

Клиент в `js/remote/` — **генерируемая копия** из `admin/client/`, править её
здесь нельзя:

```bash
node tools/sync-client.mjs --write   # из папки admin
```

Проверить, что объявление игры и бакет не разошлись:

```bash
node tools/check-config.mjs          # из папки admin
```
