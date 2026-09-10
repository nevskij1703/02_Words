// КОПИЯ ИЗ admin/client/params.js — НЕ ПРАВИТЬ ЗДЕСЬ.
// Обновляется: node tools/sync-client.mjs --write  (из папки admin)
// Правки вносить в admin/client/params.js, иначе они потеряются при следующей
// синхронизации, а две копии разойдутся молча.

// Разбивка параметров по темам — ОДНА для админки и для дев-панели игры.
//
// ЗАЧЕМ ОБЩИЙ КОД. Список параметров показывают в двух местах: в админке (что
// уедет людям) и в дев-панели на устройстве (что проверяем сейчас). Разложи их
// по темам двумя разными способами — и «Реклама» в админке перестанет совпадать
// с «Рекламой» в игре, а сверять их глазами придётся вручную на каждой правке.
//
// ТЕМУ ЗАДАЁТ ИГРА, а не угадывает админка: `remote-config.json` → `groups`.
// Раньше тема выводилась только из первого слова имени ключа, и это работало,
// пока ключей было девять и все про рекламу. На шестидесяти живых параметрах
// правило рассыпается: `muzzle_speed`, `ball_mass` и `gravity` — одна тема
// «Баллистика», но общего первого слова у них нет. Угадывание осталось
// запасным путём — для игр, которые тему не объявили.

/** Известные первые слова имён ключей. Только для игр без `groups`. */
export const GROUP_NAMES = {
  interstitial: "Межстраничная реклама",
  rewarded: "Реклама за награду",
  banner: "Баннер",
  ad: "Реклама",
  ads: "Реклама",
  rate: "Оценка приложения",
  rateus: "Оценка приложения",
  review: "Оценка приложения",
  notif: "Уведомления",
  notification: "Уведомления",
  notifications: "Уведомления",
  push: "Уведомления",
  level: "Уровни",
  levels: "Уровни",
  hint: "Подсказки",
  hints: "Подсказки",
  difficulty: "Сложность",
  balance: "Баланс",
  coins: "Экономика",
  shop: "Экономика",
  price: "Экономика",
  tutorial: "Обучение",
  onboarding: "Обучение",
  sound: "Звук",
  music: "Звук",
  audio: "Звук",
  haptic: "Вибрация",
  update: "Обновления",
  energy: "Экономика",
  hearts: "Экономика",
  generator: "Генератор уровней",
  tournament: "Турнир",
  daily: "Ежедневные награды",
  wallet: "Экономика",
};

const REST = "Прочее";

/**
 * Темы в порядке ПЕРВОГО ПОЯВЛЕНИЯ ключа, а не по алфавиту.
 *
 * Порядок ключей в `defaults` — авторский: игра перечисляет их так, как о них
 * думает («Баллистика», потом «Блоки», потом «Цены»). Алфавит этот порядок
 * стирал и ставил «Тени» перед «Снарядами» — то есть вкладки шли не так, как
 * устроена игра, и нужную приходилось искать глазами каждый раз.
 *
 * @param {{defaults?: object, ranges?: object, groups?: object}} decl
 * @returns {{title: string, keys: string[]}[]}
 */
export function paramGroups(decl) {
  const keys = Object.keys(decl?.defaults ?? decl?.ranges ?? {});
  const named = decl?.groups ?? {};

  // Первое слово имени пригодится дважды: как тема и как признак «слово
  // встречается у нескольких ключей» — одинокий незнакомый префикс темой не
  // делаем, заголовок над единственной строкой выглядит как сбой.
  const prefixCount = new Map();
  for (const key of keys) {
    const p = prefix(key);
    prefixCount.set(p, (prefixCount.get(p) ?? 0) + 1);
  }

  const order = [];
  const byTitle = new Map();
  for (const key of keys) {
    const title = titleFor(key, named, prefixCount);
    if (!byTitle.has(title)) {
      byTitle.set(title, []);
      order.push(title);
    }
    byTitle.get(title).push(key);
  }

  // «Прочее» всегда последним, где бы ни встретился его первый ключ.
  const titles = order.filter((t) => t !== REST);
  if (byTitle.has(REST)) titles.push(REST);
  return titles.map((title) => ({ title, keys: byTitle.get(title) }));
}

const prefix = (key) => String(key).split("_")[0].toLowerCase();

function titleFor(key, named, prefixCount) {
  const own = named[key];
  if (own) return String(own);
  const p = prefix(key);
  if (GROUP_NAMES[p]) return GROUP_NAMES[p];
  if ((prefixCount.get(p) ?? 0) > 1) return p;
  return REST;
}

/** Подпись поля: человеческая, иначе имя из кода. */
export function paramLabel(decl, key) {
  return decl?.labels?.[key] ?? key;
}

/** Рамка словами — одинаково в подсказке админки и в дев-панели. */
export function rangeText(range) {
  if (!range) return "рамки не объявлены";
  if (range.oneOf) return `одно из: ${range.oneOf.join(", ")}`;
  const fractional = typeof range.step === "number" && !Number.isInteger(range.step);
  const kind = fractional ? "дробное" : "целое";
  if (range.min == null) return kind === "дробное" ? "дробное число" : "целое число";
  return `${kind} от ${range.min} до ${range.max}`;
}
