# DEV_NOTES

Справка для разработчиков. Всё, что нужно знать, чтобы быстро вносить изменения.

## Куда что добавлять

| Что | Где | Как |
|-----|-----|-----|
| Новый ручной уровень | `js/levels.js` → массив `RAW` | Добавить объект `{ id, letters, mainWords, grid, placements }`. Открыть `?dev=1` → «Validate all» проверит. |
| Расширить словарь | `js/dictionary.js` → массивы `L3`/`L4`/`L_EXTRA` | Слова в верхнем регистре. Ё → Е. Длина 3-7. |
| Подключить Яндекс-рекламу | `js/ads.js` | Найти комментарии `// TODO(Yandex):`. Подключить `<script src="/sdk.js">` и реализовать `yandexAds.init/showInterstitialAd/showRewardedAd`. Установить `CONFIG.ADS.useMock = false`. |
| Поменять баланс | `js/config.js` | Секция `BALANCE` (стартовые подсказки и т.п.). |
| Частота interstitial | `js/config.js` | `ADS.interstitialEveryN`. По умолчанию 3 — реклама перед каждым 3-м уровнем. |
| Включить/выключить dev-панель | `js/config.js` | `DEV.enabled`. Также активируется только при наличии `?dev=1` в URL. |
| Звуки | `js/audio.js` | Все звуки синтезированы Web Audio API. Добавить новый — функция в объекте `SOUNDS`. |
| Анимации | `styles.css` | CSS keyframes: `flipReveal`, `shake`, `popIn`, `pillIn`, `fadeIn`. Без внешних библиотек. |
| Размер/частоты букв в генераторе | `js/levelGenerator.js` | Константы `LETTER_FREQ`, `VOWELS`. |
| Правила размещения слов | `js/levelGenerator.js` → `canPlace` | Стандартные crossword-rules: запрет параллельных некрестов, проверка перпендикулярных соседей. |
| Сетка-CSS | `styles.css` → `.crossword-grid`, `.cell` | `aspect-ratio:1`, max-width вычисляется от cols в JS. |

## Dev-панель

URL: `index.html?dev=1`. Модуль `js/devPanel.js` загружается через `import()` динамически — не попадает в бандл при `?dev=0`.

Действия:
- **Сгенерировать** — пытается N раз сгенерировать уровень по заданным параметрам.
- **Validate** — прогоняет `validateLevel()` на текущем превью.
- **Validate all (1-20)** — прогоняет валидацию по всем ручным уровням.
- **Сохранить в localStorage** — добавляет текущий уровень в `02words_dev_saved_levels`.
- **Экспорт JSON** — скачать один уровень файлом.
- **Импорт JSON** — загрузить уровень или массив уровней.
- **Скачать как levels.generated.js** — собрать ES-модуль из сохранённых.
- **Играть** — закрыть dev-панель и перейти в игру.

## Архитектурные заметки

- **ES-модули** через `<script type="module" src="js/main.js">`. Все импорты относительные. Сборщик не нужен.
- **Состояние игры** живёт в `game.js`. `ui.js` подписывается на события `onEvent({ type, ... })` и обновляет DOM.
- **Кроссворд** не хранит карту ячеек как массив — она вычисляется из `placements` при загрузке уровня (см. `crossword.buildCellMap`).
- **Pointer events** в `input.js`: единый поток `pointerdown/move/up/cancel` + `setPointerCapture`. CSS: `.wheel { touch-action: none }`, SVG-overlay `pointer-events: none`, буквы `pointer-events: auto`.
- **localStorage schema**: при изменении формата увеличить `SCHEMA_VERSION` в `storage.js`. Старый объект сохраняется как `02words_backup_v{N}`.
- **Регенерация уровней**: `node scripts/generate_levels.mjs` — детерминированно пишет `js/levels.generated.js`.

## Тестовый чек-лист (smoke)

1. Открыть `index.html` (или `?dev=1`). Должен сразу появиться уровень 1: круг из 3 букв КОТ + кроссворд 3×3.
2. Свайпнуть К→О→Т → кроссворд раскрывается (3 ячейки строки), звук «правильно».
3. Свайпнуть Т→О→К → кроссворд завершён, экран «Уровень пройден!».
4. Кнопка «Дальше» → переход на уровень 2 (СОН). Перед уровнем 4 — mock interstitial-overlay.
5. Свайпнуть «НО» (2 буквы) → shake круга + звук «неправильно».
6. Нажать 💡 → одна закрытая ячейка раскрывается, счётчик подсказок −1.
7. Когда подсказки кончатся — диалог «Посмотреть рекламу за +1 подсказку?» → mock-rewarded → +1.
8. 🔀 → буквы в круге переставляются. ✖ → текущий ввод сбрасывается. 🔊 → звук вкл/выкл.
9. Перезагрузить страницу → игра продолжается с текущего уровня.
10. `?dev=1` → «Validate all» должен показать «✅ Все 20 уровней валидны».

## Сборка APK

Игра — это набор статических файлов. Поскольку всё работает через относительные пути и localStorage, никаких правок для упаковки не нужно. Варианты:

1. **Capacitor** (рекомендуется):
   ```
   npm init -y
   npm install @capacitor/core @capacitor/cli @capacitor/android
   npx cap init "Слова из букв" com.yourstudio.wordsongs --web-dir=.
   npx cap add android
   npx cap copy
   npx cap open android
   ```
   Затем собрать APK через Android Studio.

2. **TWA / Bubblewrap** — если игра доступна по HTTPS на статическом хосте: `bubblewrap init --manifest https://example.com/manifest.json` → собирает PWA-обёртку.

3. **Cordova** — аналогично Capacitor.

4. **Простой нативный WebView** — создать пустой Android-проект, скопировать файлы в `assets/`, загружать `file:///android_asset/index.html`.

Не забудьте позже добавить иконку (`192×192`, `512×512`) и splash-screen — сейчас их нет (см. TODO.md).

## Что трогать с осторожностью

- `crossword.buildCellMap` бросает ошибку при конфликте букв в placements — это намеренно. validateLevel ловит это в попытке.
- `dictionary.normalize` — единственная точка преобразования регистра и Ё→Е. Везде сохраняйте этот пайплайн.
- При изменении формата уровня (`{id, letters, mainWords, grid, placements}`) обновите `validateLevel()`, генератор и оба файла с уровнями.

## Локальный сервер

В корне проекта:
```
python -m http.server 8000
# или
npx serve .
```
ES-модули требуют HTTP-схему — `file://` не сработает в большинстве браузеров.
