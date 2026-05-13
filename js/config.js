// config.js — единое место для всех настроек игры.
// Изменения здесь не должны требовать правок в другой логике.

export const CONFIG = {
  // === БАЛАНС ===
  BALANCE: {
    startingHints: 5,          // подсказок на старте новой игры
    hintsPerRewardedAd: 1,     // сколько подсказок дать за просмотр rewarded
    minLevelDurationMs: 30_000 // ниже — статистика не учитывается (антифрод)
  },

  // === РЕКЛАМА ===
  ADS: {
    useMock: true,                  // false → пытаться использовать Yandex SDK
    interstitialEveryN: 3,          // показывать межстраничную каждые N уровней
    mockInterstitialDurationMs: 1500,
    mockRewardedDurationMs: 2000
  },

  // === DEV ===
  DEV: {
    enabled: true,                  // если false — ?dev=1 игнорируется
    secretTapsToOpen: 5             // в будущем: 5x тапов по логотипу
  },

  // === ГЕНЕРАТОР УРОВНЕЙ (значения по умолчанию для dev-панели) ===
  GENERATOR_DEFAULTS: {
    letterCount: 5,
    minWords: 3,
    maxWords: 5,
    minWordLen: 3,
    maxWordLen: 5,
    difficulty: 'normal',           // 'easy' | 'normal' | 'hard'
    maxPlacementAttempts: 200,
    maxLetterReshuffles: 30
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
