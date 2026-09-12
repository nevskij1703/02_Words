// КОПИЯ ИЗ admin/client/curve.js — НЕ ПРАВИТЬ ЗДЕСЬ.
// Обновляется: node tools/sync-client.mjs --write  (из папки admin)
// Правки вносить в admin/client/curve.js, иначе они потеряются при следующей
// синхронизации, а две копии разойдутся молча.

// Кривая сложности строкой: `1-3-3-6-(4-4-7-4-4-10)`.
//
// До скобки — РАЗГОН: по одному рейтингу на уровень, с первого. В скобке —
// ЦИКЛ: он начинается сразу после разгона и повторяется бесконечно. Пример
// читается как «1, 3, 3, 6, потом 4-4-7-4-4-10 по кругу».
//
// ПОЧЕМУ СТРОКА, А НЕ ДВА СПИСКА ЧИСЕЛ. Конфиг умеет числа, а кривая — это
// последовательность переменной длины, и разложить её по ключам можно только
// заранее выбранным числом ключей (`curve_1`, `curve_2`, …). Тогда «добавить
// уровень в цикл» упирается в потолок, выбранный однажды и наугад, а пустые
// ключи в середине означают неизвестно что. Одна строка не имеет ни того, ни
// другого ограничения, а от опечаток её страхует разбор ниже: строка, которую
// не удалось разобрать, ОТБРАСЫВАЕТСЯ целиком, и игра остаётся на своей.
//
// ЦИКЛ ОБЯЗАТЕЛЕН, и это главная проверка. Строка `1-3-3-6` выглядит совершенно
// нормально, но отвечает на вопрос «что играть на пятом уровне» пустотой — а
// уровни в этих играх бесконечны. Такую кривую надо ловить в поле ввода, а не
// на живом игроке, который дошёл до конца разгона.

/** Сколько рейтингов разрешаем в одной строке — разгон и цикл вместе. */
const MAX_STEPS = 64;

/**
 * Разобрать строку. Возвращает `{ prefix, cycle }` либо `null`, если строка
 * негодная — причину словами даёт `curveError`.
 *
 * @param {string} text
 * @param {object} [opts]
 * @param {number} [opts.min=1]   — наименьший допустимый рейтинг
 * @param {number} [opts.max=10]  — наибольший; у игры их ровно столько,
 *                                  сколько заготовлено пресетов
 * @param {number} [opts.maxSteps=64]
 */
export function parseCurve(text, opts = {}) {
  return read(text, opts).curve;
}

/**
 * Почему строка негодная — одной фразой для человека. `null`, если годная.
 *
 * Отдельной функцией, а не вторым полем результата, потому что зовут их в
 * разных местах: игре нужен только разбор, полю ввода в админке — только
 * причина.
 */
export function curveError(text, opts = {}) {
  return read(text, opts).error;
}

/** Обратно в строку — нормализованную: без пробелов, со скобкой в конце. */
export function formatCurve(curve) {
  if (!curve) return "";
  const head = curve.prefix.join("-");
  const tail = `(${curve.cycle.join("-")})`;
  return head ? `${head}-${tail}` : tail;
}

/**
 * Рейтинг уровня `level` (нумерация с единицы).
 *
 * Уровень ниже первого не бывает, но значение всё равно определено: иначе
 * ошибка вызова превращалась бы в `undefined` внутри генератора, а там она
 * обнаруживается уже пустым экраном.
 */
export function curveRating(curve, level) {
  const i = Math.max(0, (Number(level) | 0) - 1);
  if (i < curve.prefix.length) return curve.prefix[i];
  const k = (i - curve.prefix.length) % curve.cycle.length;
  return curve.cycle[k];
}

/** Первые `count` рейтингов — для превью в админке и в дев-панели. */
export function curvePreview(curve, count = 12) {
  const out = [];
  for (let n = 1; n <= count; n++) out.push(curveRating(curve, n));
  return out;
}

// ------------------------------------------------------------ разбор

function read(text, opts) {
  const min = Number.isFinite(opts.min) ? opts.min : 1;
  const max = Number.isFinite(opts.max) ? opts.max : 10;
  const maxSteps = Number.isFinite(opts.maxSteps) ? opts.maxSteps : MAX_STEPS;

  if (typeof text !== "string") return fail("нужна строка");
  // Пробелы разрешаем при вводе и убираем при разборе: «1-3-3-6 - (4-4)» это
  // та же кривая, а требовать от человека точного набора незачем.
  const s = text.replace(/\s+/g, "");
  if (!s) return fail("пусто");

  const open = s.indexOf("(");
  const close = s.indexOf(")");
  if (open === -1) return fail("нет цикла в скобках — после разгона неизвестно, что играть дальше");
  if (close === -1) return fail("скобка не закрыта");
  if (close !== s.length - 1) return fail("после закрывающей скобки ничего быть не должно");
  if (s.indexOf("(", open + 1) !== -1 || s.indexOf(")", 0) !== close) {
    return fail("скобок должно быть ровно две — одна пара вокруг цикла");
  }

  // Разделитель перед скобкой необязателен: «1-3(4-5)» и «1-3-(4-5)» — одно.
  const headText = s.slice(0, open).replace(/-$/, "");
  const cycleText = s.slice(open + 1, close);

  const head = headText ? split(headText, min, max) : { list: [] };
  if (head.error) return fail(`разгон: ${head.error}`);

  // Пустые скобки проверяем ДО разбора: `"".split("-")` даёт один пустой
  // кусок, и без этой строки человек получал бы «два разделителя подряд» там,
  // где он просто не написал в скобках ничего.
  if (!cycleText) return fail("цикл пустой — в скобках должен быть хотя бы один уровень");

  const cycle = split(cycleText, min, max);
  if (cycle.error) return fail(`цикл: ${cycle.error}`);

  if (head.list.length + cycle.list.length > maxSteps) {
    return fail(`слишком длинно: уровней в строке ${head.list.length + cycle.list.length}, разрешено ${maxSteps}`);
  }

  return { curve: { prefix: head.list, cycle: cycle.list }, error: null };
}

function split(text, min, max) {
  const parts = text.split("-");
  const list = [];
  for (const part of parts) {
    if (part === "") return { error: "два разделителя подряд или разделитель с краю" };
    // Строгая проверка записи, а не `Number()`: тот принимает «1e1», «0x3» и
    // « 7 » — в кривой сложности это опечатки, и молча принять их значило бы
    // выдать игроку не тот уровень, который написан в поле.
    if (!/^\d+$/.test(part)) return { error: `«${part}» — не целое число` };
    const n = Number(part);
    if (n < min || n > max) return { error: `«${part}» вне диапазона ${min}..${max}` };
    list.push(n);
  }
  return { list };
}

const fail = (error) => ({ curve: null, error });
