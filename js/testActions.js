// js/testActions.js — что умеет тестовый мост в этой игре.
//
// ТО ЖЕ САМОЕ, ЧТО КНОПКИ ДЕВ-ПАНЕЛИ, и это не совпадение: нужны они по одному
// поводу — поставить игру в состояние, до которого честной игрой идти долго.
// Разница в том, кто нажимает: панель — человек, мост — агент по usb-отладке.
//
// ПОЧЕМУ ЭТО НЕ ДЫРА, хотя «+20 подсказок» здесь есть и в релизной сборке: мост
// исполняет только ПОДПИСАННУЮ команду, а приватного ключа в APK нет
// (`admin/secrets`). Дев-панель так защитить нельзя — у неё кнопки, а не
// подписи, — поэтому её и прячут за `?dev=1`.
//
// `state` ВАЖНЕЕ ОСТАЛЬНОГО: действие без чтения состояния нечем подтвердить.

import { registerTestActions } from './remote/testBridge.js';
import * as storage from './storage.js';

const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export function installTestActions() {
  registerTestActions({
    state: {
      note: 'снимок: уровень, подсказки, настройки, найдено слов',
      run: () => {
        const s = storage.getState();
        return {
          currentLevel: s.currentLevel,
          hints: s.hints,
          wordsFound: s.wordsFound,
          completedLevels: Array.isArray(s.completedLevels) ? s.completedLevels.length : null,
          pushEnabled: storage.getPushEnabled(),
          settings: storage.getSettings(),
        };
      },
    },

    'level.set': {
      note: 'перейти на уровень (0-based, как в сейве)',
      args: { level: 'число' },
      run: (args) => {
        const level = Math.max(0, Math.round(num(args.level, 0)));
        storage.setCurrentLevel(level);
        // Перезагрузка нужна: экран уровня строится при старте, и смена номера
        // в сейве сама по себе его не перерисовывает.
        return { currentLevel: storage.getCurrentLevel(), needsReload: true };
      },
    },

    'grant.hints': {
      note: 'добавить подсказок',
      args: { amount: 'число' },
      run: (args) => {
        storage.addHints(Math.round(num(args.amount, 5)));
        return { hints: storage.getHints() };
      },
    },

    'progress.reset': {
      note: 'стереть сейв целиком; после этого нужен app.reload',
      run: () => {
        storage.reset();
        return { wiped: true };
      },
    },
  });
}
