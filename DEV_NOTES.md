# DEV_NOTES

Краткая справка для разработчиков.

## Куда что добавлять

| Что | Где | Как |
|-----|-----|-----|
| Новый уровень вручную | `js/levels.js` | Добавить объект в `HAND_CRAFTED_LEVELS`, прогнать через `validateLevel()` |
| Расширить словарь | `js/dictionary.js` | Добавить слова в массив `WORDS`. Все в верхнем регистре. |
| Подключить Яндекс-рекламу | `js/ads.js` | Найти комментарии `// TODO(Yandex):` и заменить mock-реализации на вызовы Yandex Games SDK |
| Поменять баланс | `js/config.js` | Секции `BALANCE` (стартовые подсказки, частота interstitial) |
| Включить/выключить dev-панель | `js/config.js` | `DEV.enabled` (по умолчанию проверяется только `?dev=1` в URL) |
| Поменять mock на real ads | `js/config.js` | `ADS.useMock = false` (нужен также Yandex-SDK код) |
| Звуки | `js/audio.js` | Все звуки синтезированы Web Audio API. Чтобы добавить новый — функция `play(name)`. |
| Анимации | `styles.css` | CSS-keyframes (`flipReveal`, `shake`, `popIn`). Без сторонних библиотек. |

## Dev-панель

URL: `index.html?dev=1`

Возможности:
- Сгенерировать уровень по параметрам (кол-во букв, диапазон длин/числа слов, сложность).
- Просмотреть слова и кроссворд.
- Запустить `validateLevel()`.
- Сохранить в localStorage (для последующего инспекта).
- Экспорт уровня в JSON (скачивается файл).
- Импорт уровня из JSON-файла.
- Кнопка «Validate all» — прогоняет все встроенные уровни через валидатор.

## Архитектурные заметки

- **ES-модули**: `<script type="module" src="js/main.js">`. Все импорты — относительные.
- **Состояние игры** живёт в `game.js`. `ui.js` подписывается на события и обновляет DOM.
- **Кроссворд** не хранит карту ячеек — она вычисляется из `placements` каждый раз при загрузке уровня.
- **Pointer events** в `input.js`: `setPointerCapture` + `touch-action: none` + `pointer-events: none` для SVG-overlay.
- **localStorage schema**: при изменении формата увеличить `SCHEMA_VERSION` в `storage.js`; старый объект сохраняется как `02words_backup_v{N}`.

## Сборка APK

Игра — это набор статических файлов. Самые простые варианты:

1. **TWA / Bubblewrap** (Trusted Web Activity, если хост доступен по HTTPS) — выложить файлы на любой статический хост, обернуть через Bubblewrap CLI.
2. **Capacitor**: `npx cap init` → положить файлы в `www/` → `npx cap add android` → `npx cap open android` → собрать APK через Android Studio.
3. **Cordova**: аналогично, через `cordova create` + WebView.
4. **Простой нативный WebView**: создать пустой Android-проект, скопировать файлы в `assets/`, грузить `file:///android_asset/index.html`.

Все ресурсы относительные → ничего перенастраивать не нужно.

## Запуск в DevTools

`F12` → toggle device toolbar (Ctrl+Shift+M) → выбрать любой Android-телефон. Touch-эмуляция автоматически активна.
