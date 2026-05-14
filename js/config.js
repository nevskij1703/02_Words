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
  ADS: {
    useMock: true,                  // false → пытаться использовать Yandex SDK
    interstitialEveryN: 1,          // показывать межстраничную каждые N уровней (1 = после каждого)
    mockInterstitialDurationMs: 1500,
    mockRewardedDurationMs: 2000
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
