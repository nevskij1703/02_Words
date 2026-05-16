// config.js — единое место для всех настроек игры.
// Изменения здесь не должны требовать правок в другой логике.

export const CONFIG = {
  // === БАЛАНС ===
  BALANCE: {
    startingHints: 5,          // подсказок на старте новой игры
    hintsPerRewardedAd: 5,     // сколько подсказок дать за просмотр rewarded
    hintsRefillCap: 5,         // после каждого уровня даём +1 подсказку, пока не упрёмся в этот потолок
    wrongStreakForHintBanner: 3, // через сколько подряд неправильных слов показывать кнопку «Использовать подсказку»
    minLevelDurationMs: 30_000 // ниже — статистика не учитывается (антифрод)
  },

  // === РЕКЛАМА ===
  // Контракт: см. docs/ADS.md.
  // Если в WebView APK подключён нативный Yandex Mobile Ads SDK через html2apk
  // (-YandexAdsBridge), JS-сторона дёргает window.YandexAds.* и слушает
  // window.__yandexAdsCallback. В браузерном dev-режиме (нет window.YandexAds)
  // автоматически падаем в mock с DOM-оверлеем.
  ADS: {
    useMock: false,                 // true → принудительный mock даже если bridge доступен (полезно для dev)
    // useDemoUnits: на устройстве вместо реальных unit-ID использовать
    // demo-id от Yandex (всегда показывают тестовое объявление). Нужно для
    // дебага: если реальные unit'ы ещё на модерации в Yandex Partner, SDK
    // отвечает no-fill и реклама «не запускается». С demo сразу видно
    // работает ли пайплайн SDK→Java→JS как таковой. **Перед публикацией
    // в стор обязательно вернуть в false.**
    useDemoUnits: true,
    unitInterstitialDemo: 'demo-interstitial-yandex',
    unitRewardedDemo:     'demo-rewarded-yandex',
    // Yandex Mobile Ads unit-ID (partner.yandex.ru/mobile-ads).
    unitInterstitial: 'R-M-19273487-1',
    unitRewarded:     'R-M-19273487-2',
    // Интерстишиал-расписание:
    //   - не показывать до перехода на N-й уровень (zero-based, idx=3 → L4);
    //   - между двумя показами в одной сессии — минимум cooldownMs;
    //   - если игрок начал смотреть рекламу и НЕ ВЕРНУЛСЯ обратно
    //     (закрыл приложение), а перезапустился в течение pendingResumeWindowMs —
    //     при следующем старте уровня сразу принудительно показываем.
    interstitialMinLevel:       3,
    interstitialCooldownMs:     2 * 60 * 1000,
    pendingResumeWindowMs:      5 * 60 * 1000,
    interstitialEveryN:         1,  // (legacy) — оставлено для совместимости; новый расчёт не использует.
    mockInterstitialDurationMs: 1500,
    mockRewardedDurationMs:     2000
  },

  // === DEV ===
  DEV: {
    enabled: true,                  // если false — ?dev=1 игнорируется
    secretTapsToOpen: 5             // в будущем: 5x тапов по логотипу
  },

  // === ГЕНЕРАТОР УРОВНЕЙ (значения по умолчанию для dev-панели) ===
  // Цель: плотные кроссворды на 7-12 слов, центральное слово 5+ букв.
  GENERATOR_DEFAULTS: {
    letterCount: 6,
    centerWordMinLen: 5,            // длина самого длинного (центрального) слова ≥ этой
    minWords: 7,
    maxWords: 12,
    minWordLen: 3,
    maxWordLen: 7,
    maxGridDim: 11,                 // макс. размер сетки в любом измерении (для портрета)
    difficulty: 'normal',           // 'easy' | 'normal' | 'hard'
    maxPlacementAttempts: 200,
    maxLetterReshuffles: 80
  },

  // === АУДИО ===
  AUDIO: {
    defaultEnabled: true,
    masterVolume: 0.4
  },

  // === ВИБРАЦИЯ ===
  HAPTIC: {
    defaultEnabled: true,
    badWordMs: 80,
    correctWordMs: 30
  }
};
