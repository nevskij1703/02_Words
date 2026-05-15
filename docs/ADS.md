# Яндекс-реклама — интеграция (02_Words)

Игра использует модуль [js/ads.js](../js/ads.js), который определяет backend на старте:

| Backend | Условие | Когда применяется |
|---|---|---|
| `native` | `window.YandexAds.showInterstitial` существует | Production APK (html2apk c `-YandexAdsBridge`) |
| `mock` | `window.YandexAds` отсутствует или `CONFIG.ADS.useMock = true` | dev в браузере |

Никакой веб-SDK слой (Yandex Games `/sdk.js`, РСЯ `context.js`) **не подключается** — проект целится только в РуСтор APK.

## Слоты рекламы

| Слот | Когда показывается | Метод | unit-ID |
|---|---|---|---|
| **Interstitial** | После уровня, через `shouldShowInterstitial(idx)` (по умолчанию каждый уровень начиная с 3-го) | `showInterstitialAd()` | `CONFIG.ADS.unitInterstitial` |
| **Rewarded** | Кнопка «Использовать подсказку» при `hints === 0`, либо диалог «Подсказки закончились → Смотреть» | `showRewardedAd()` | `CONFIG.ADS.unitRewarded` |

Точки вызова — [js/ui.js](../js/ui.js):226–243 (баннер hint), 258–281 (диалог), 307–309 (после уровня).

Unit-ID в [js/config.js](../js/config.js):
- Interstitial: `R-M-19273487-1`
- Rewarded: `R-M-19273487-2`

Источник: [Yandex Partner Mobile Ads](https://partner.yandex.ru/mobile-ads).

## Сборка APK с включённым Yandex Mobile Ads

```
& "$env:LOCALAPPDATA\Programs\html2apk\html2apk.ps1" `
  -ProjectFolder "C:\Users\Александр\Desktop\Claude\02_Words" `
  -AppName "Слова из букв" `
  -AppId "com.terekh.words" `
  -OutputFile "$env:USERPROFILE\Downloads\Words.apk" `
  -YandexAdsBridge
```

html2apk автоматически добавляет gradle-зависимость, ACCESS_NETWORK_STATE, `YandexAdsBridge.java` и патчит MainActivity. Подробности — в `01_RS_GlitterSort/docs/ADS.md` (там же полный исходник Java-моста).

## Контракт callback'ов от Java

```js
window.__yandexAdsCallback(kind, event)
// kind:  'interstitial' | 'rewarded'
// event: 'closed' | 'rewarded'
```

- `interstitial` всегда завершается событием `closed`.
- `rewarded` приходит с `rewarded`, если пользователь досмотрел до конца; иначе `closed`.

Имя callback'а зафиксировано в Java-классе `YandexAdsBridge` и не должно меняться в JS.

## Mock backend (dev)

В браузере без bridge'а `js/ads.js` показывает DOM-оверлей со счётчиком (длительности — `CONFIG.ADS.mockInterstitialDurationMs` / `mockRewardedDurationMs`).

`showInterstitialAd()` → `{ shown: true }` после закрытия оверлея.
`showRewardedAd()` → `{ rewarded: true }` (mock всегда даёт reward).

## Проверка backend

В DevTools-консоли:
```js
import('./js/ads.js').then(m => console.log(m.getBackend()));  // 'native' | 'mock'
```

Либо просто наблюдай за `[ads] backend=...` в console.log на старте.

## Каденс

| Действие | Бюджет |
|---|---|
| Interstitial | каждый `CONFIG.ADS.interstitialEveryN` уровней (по умолчанию 1, начиная с уровня 3+) |
| Rewarded | по запросу пользователя через UI |

`shouldShowInterstitial(levelIndex)` пропускает первые 2 уровня всегда — это для retention.
