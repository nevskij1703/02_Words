# ANALYTICS — карта событий проекта «Слова из Букв»

Проект подключён к **Yandex AppMetrica** (бесплатный analytics SDK от Яндекса).
Подключение: [js/analytics.js](../js/analytics.js), native bridge — `html2apk -YandexAppMetrica`.

**API key:** `5f0e9cf4-3c7e-4b73-b80d-d261a6b96ebf` (хранится в [.claude/build-config.json](../.claude/build-config.json) → `appMetricaApiKey`).

**Контракт обёртки и архитектура:** см. skill `connect-appmetrica` (`~/.claude/skills/connect-appmetrica/SKILL.md`).

---

## События

Все события идут через `window.Analytics.event(name, params)` (или `Analytics.adShown({...})`).
Системные параметры (`app_name='words'`, `app_version`, `platform`, `user_id`) добавляются автоматически — не дублируй их в params.

| Event name | Params | File:line | Когда срабатывает |
|---|---|---|---|
| `session_start` | — | [js/main.js](../js/main.js) bootstrap end | Сразу после `analytics.configure()`. Маркер начала сессии (auto-tracked app_open приходит дополнительно). |
| `level_start` | `{ level_num, level_id }` | [js/ui.js](../js/ui.js) `loadLevel()` | Начало уровня. `level_num` — 1-based, `level_id` — стабильный ID уровня. |
| `level_complete` | `{ level_num }` | [js/ui.js](../js/ui.js) `handleGameEvent` case `level-complete` | Все главные слова найдены. |
| `word_found` | `{ word_length, is_bonus, level_num }` | [js/ui.js](../js/ui.js) `handleGameEvent` case `word-main` / `word-bonus` | Каждое найденное слово. `is_bonus=true` — бонусное (не главное). |
| `hint_used` | `{ level_num, source: 'free' }` | [js/ui.js](../js/ui.js) `handleGameEvent` case `hint` | Использована подсказка из счётчика. |
| `ad_interstitial_shown` | `{ placement: 'level_transition' }` | [js/ui.js](../js/ui.js) `showWinScreen` | Перед показом межстраничной рекламы при переходе на следующий уровень. |
| `ad_rewarded_shown` | `{ placement, watched, reward_given }` | [js/ui.js](../js/ui.js) — `hintBannerBtn`, `showRewardedAskForHint` | После rewarded callback. `placement`: `'hint_banner'` или `'hint_dialog'`. |
| `settings_opened` | — | [js/ui.js](../js/ui.js) `els.settingsBtn` click | Юзер открыл настройки. |

### Системные параметры (auto-injected)

- `app_name`: `'words'`
- `app_version`: `'1.0.0'` (из [js/main.js](../js/main.js))
- `platform`: `'android'` (или `'browser'` в dev)
- `user_id`: UUID из `Storage.getUserId()`

### AppMetrica auto-tracked (НЕ дублируем)

- `app_open` / sessions / session length — авто
- Retention D1/D7/D30 — авто, через device-ID
- Crashes / ANRs — авто

---

## Где смотреть в дашборде AppMetrica

Открыть https://appmetrica.yandex.ru/, выбрать приложение «Слова из Букв».

### Audience (аудитория)

**Reports → Audience overview**
- DAU, WAU, MAU
- Сессии за период
- Средняя длительность сессии

### Retention (возвращаемость)

**Reports → Retention**
- Выбрать «Открытие приложения» (auto-tracked) или `session_start` (custom).
- Cohort: D1 / D3 / D7 / D14 / D30.
- Цель: D1 ≥ 35%, D7 ≥ 12% (для casual без push); с push можно надеяться на ≥ 50% / ≥ 18%.

### Funnels (воронки)

**Reports → Funnels → Создать воронку**

**Воронка прохождения уровней:**
1. `level_start`
2. `level_complete`

Это покажет % юзеров, которые не дошли до победы (либо ушли, либо бросили в середине).

**Воронка эффекта interstitial:**
1. `ad_interstitial_shown`
2. `level_start` (следующий уровень)

% «не открыли следующий уровень после рекламы» — показатель раздражения.

**Воронка rewarded engagement:**
1. `ad_rewarded_shown` (placement=hint_banner)
2. `word_found` (в течение N минут)

% юзеров, которым реклама за подсказку реально помогла.

### Ad views (просмотры рекламы)

**Reports → Events → выбрать `ad_interstitial_shown` или `ad_rewarded_shown`**
- Total count за период
- Group by `placement` → разрез: на каких точках рекламу видят чаще
- Для rewarded — filter `reward_given=true` → показано+просмотрено до конца

### Custom segments (сегменты)

**Audience → Сегменты → Создать**

Примеры:
- «Игроки, прошедшие 10+ уровней»: фильтр по `level_complete` event count ≥ 10
- «Зависли на уровне 5»: фильтр `level_fail` (если будет добавлено) или `level_start` count ≥ 5 на одном level_num без `level_complete`
- «Heavy rewarded users»: `ad_rewarded_shown` ≥ 5 раз

---

## Как добавить новое событие

1. Придумай **семантичное имя** (snake_case, без префиксов проекта — это уже даёт `app_name`). Сначала проверь общую таксономию в skill `connect-appmetrica`. Если событие подходит под общее имя — используй его.
2. Добавь вызов в нужном месте кода: `window.Analytics.event('event_name', { ...params })`.
3. Запиши в таблицу выше: имя, params, file:line, когда срабатывает.
4. Если событие специфично для этого проекта — упомяни в [CLAUDE.md](../CLAUDE.md) → раздел «Аналитика».
5. **НЕ переименовывай уже опубликованные события** — это сломает воронки и retention в дашборде у живых юзеров.

---

## Privacy

Сбор данных описан в [Store_Info/PRIVACY_POLICY.md](../Store_Info/PRIVACY_POLICY.md) → раздел «Аналитика (Yandex AppMetrica)». При изменении набора собираемых событий — обнови `.md` и регенерируй `.pdf`. `prepare-release-candidate` сделает PDF автоматически.
