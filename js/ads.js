// ads.js — рекламный менеджер. Сейчас mock-режим, потом подключим Яндекс.
//
// Контракт:
//   await ads.showInterstitialAd()       → resolves, когда реклама закрыта
//   await ads.showRewardedAd()           → { rewarded: true|false }
//   ads.shouldShowInterstitial(levelIdx) → boolean (частота из CONFIG.ADS.interstitialEveryN)

import { CONFIG } from './config.js';

// === Mock-реализации с UI-оверлеями ===

function makeOverlay(text, durationMs, withCountdown = true) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'interstitial';
    const card = document.createElement('div');
    card.className = 'mock-ad';
    card.innerHTML = `<div>🎬 ${text}</div>${withCountdown ? '<div class="countdown">3</div>' : ''}`;
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    let remaining = Math.ceil(durationMs / 1000);
    const counter = card.querySelector('.countdown');
    const interval = withCountdown ? setInterval(() => {
      remaining--;
      if (counter) counter.textContent = String(Math.max(0, remaining));
    }, 1000) : null;

    setTimeout(() => {
      if (interval) clearInterval(interval);
      overlay.remove();
      resolve();
    }, durationMs);
  });
}

const mockAds = {
  async showInterstitialAd() {
    // TODO(Yandex): заменить на ysdk.adv.showFullscreenAdv({...})
    await makeOverlay('Реклама (mock)', CONFIG.ADS.mockInterstitialDurationMs);
    return { shown: true };
  },
  async showRewardedAd() {
    // TODO(Yandex): заменить на ysdk.adv.showRewardedVideo({ callbacks: {...} })
    await makeOverlay('Просмотр за награду (mock)', CONFIG.ADS.mockRewardedDurationMs);
    return { rewarded: true };
  }
};

// === Яндекс-адаптер (заготовка) ===
// Когда подключим Yandex Games SDK, реализация будет:
//   await YaGames.init() → ysdk
//   ysdk.adv.showFullscreenAdv({ callbacks: { onClose: ... } })
//   ysdk.adv.showRewardedVideo({ callbacks: { onRewarded: () => rewarded=true, onClose: ... } })

const yandexAds = {
  ysdk: null,
  async init() {
    // TODO(Yandex): подгружать <script src="/sdk.js"> и вызывать YaGames.init()
    console.warn('[ads] yandex SDK not yet integrated, falling back to mock');
  },
  async showInterstitialAd() {
    return mockAds.showInterstitialAd();
  },
  async showRewardedAd() {
    return mockAds.showRewardedAd();
  }
};

// === Публичный API ===

const impl = CONFIG.ADS.useMock ? mockAds : yandexAds;

export async function initAds() {
  if (!CONFIG.ADS.useMock && yandexAds.init) {
    await yandexAds.init();
  }
}

export function showInterstitialAd() {
  return impl.showInterstitialAd();
}

export function showRewardedAd() {
  return impl.showRewardedAd();
}

export function shouldShowInterstitial(levelIndex) {
  const every = CONFIG.ADS.interstitialEveryN;
  if (every <= 0) return false;
  // Показываем перед уровнем `every`, `2*every`, … (т.е. перед каждым N-м, начиная с N).
  return levelIndex > 0 && levelIndex % every === 0;
}
