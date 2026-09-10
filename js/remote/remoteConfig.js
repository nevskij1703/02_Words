// КОПИЯ ИЗ admin/client/remoteConfig.js — НЕ ПРАВИТЬ ЗДЕСЬ.
// Обновляется: node tools/sync-client.mjs --write  (из папки admin)
// Правки вносить в admin/client/remoteConfig.js, иначе они потеряются при следующей
// синхронизации, а две копии разойдутся молча.

// Удалённая конфигурация: значения, которые можно менять БЕЗ выпуска обновления.
//
// ДЕФОЛТЫ ЖИВУТ ЗДЕСЬ, В ИГРЕ, А НЕ НА СЕРВЕРЕ. Пустой, недоступный или битый
// конфиг обязан означать «игра работает как была» — иначе упавший бакет
// превращается в упавшую игру у всех сразу. Сервер только ПЕРЕБИВАЕТ значения,
// он их не задаёт.
//
// Читается статический JSON из публичного бакета — функции в этой схеме нет.
// У Interier Planner конфиг раздаёт Cloud Function, но лишь потому, что функция
// там уже была ради платежей: заводить её ради одного JSON значило бы получить
// выкладку, сервисный аккаунт и ключи S3 там, где хватает файла в бакете.
// Клиент знает только адрес, так что появление функции однажды поменяет URL и
// ничего больше.
//
// Использование (ES-модули / Vite):
//
//     import { initRemoteConfig, rc } from "./remoteConfig.js";
//     await initRemoteConfig({ appId: "com.terekh.hole", defaults: RC_DEFAULTS, ranges: RC_RANGES });
//     if (rc("interstitial_every") > 3) ...
//
// В classic-JS проектах подключается собранный `remoteConfig.iife.js`, который
// кладёт то же самое в `window.RemoteConfig` (см. build-iife.mjs).

import { pickGroups, groupLabel } from "./abTest.js";

const CDN = "https://games-config-b1g8r9eo.storage.yandexcloud.net";

/** Сколько ждём сеть. Конфиг — не то, ради чего человек смотрит на пустой экран. */
const TIMEOUT_MS = 4000;

/**
 * Сколько живёт последний удачный ответ, если сеть пропала.
 *
 * Ключ включает appId НЕ ради порядка: под общим ключом кэш одной игры
 * подставляется другой. На устройстве игра одна, поэтому в бою этого не
 * увидеть — зато видно в дев-панели и в сквозных проверках, где за один
 * процесс опрашивают несколько appId, и «взялся конфиг соседней игры»
 * выглядит там как загадочно неверные значения.
 */
const cacheKeyFor = (appId) => `rc.cache.${appId}`;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

let values = {};
let defaults = {};
let ranges = {};
let cohorts = [];
let ready = false;

/**
 * Объявить дефолты и рамки — СИНХРОННО, при загрузке модуля игры.
 *
 * Отдельно от `initRemoteConfig` намеренно. Если дефолты приезжают только
 * вместе с загрузкой, то `rc()` между стартом игры и ответом сети отдаёт
 * `undefined` — а это первые кадры, где считается ритм рекламы и лимиты. На
 * быстрой сети такое не воспроизводится, на медленной ломается каждый раз, и
 * выглядит как случайный баг. Поэтому игра объявляет свои значения ДО всякой
 * сети, а сеть потом их только перебивает.
 *
 * Принимает объект прямо из `<игра>/remote-config.json` — того же файла, из
 * которого читает админка.
 */
export function configure(decl) {
  defaults = decl?.defaults ?? {};
  ranges = decl?.ranges ?? {};
  return rcAll();
}

/**
 * Значение настройки. До загрузки и после провала сети отдаёт дефолт, поэтому
 * вызывать можно откуда угодно и когда угодно — проверять «а загрузился ли
 * конфиг» на каждом обращении не нужно.
 */
export function rc(key) {
  return key in values ? values[key] : defaults[key];
}

/** Все значения — для дев-панели и отладки. Не для игровой логики. */
export function rcAll() {
  return { ...defaults, ...values };
}

/** Загружен ли живой конфиг. Игровой логике знать это не нужно, дев-панели — да. */
export function rcReady() {
  return ready;
}

/**
 * Группы A/B, в которые попало это устройство: `["generous:wide"]`.
 * Уходит в каждое событие аналитики параметром `ab` — без этого тест
 * бессмысленен: разбиение есть, а сравнить группы нечем.
 */
export function rcCohorts() {
  return cohorts.slice();
}

/**
 * Значения зажимаются рамками ПЕРЕД применением. Опечатка `"free_hints": 0` в
 * бакете иначе означала бы «завтра ни у кого нет подсказок» — то есть правка
 * конфига становится способом сломать игру всем сразу, а именно от этого
 * удалённая конфигурация и должна страховать.
 *
 * Ключ без объявленной рамки НЕ ПРИМЕНЯЕТСЯ вовсе: незнакомое имя означает либо
 * опечатку, либо конфиг от другой версии игры.
 */
function sanitize(raw) {
  const out = {};
  for (const [key, value] of Object.entries(raw ?? {})) {
    const range = ranges[key];
    if (!range) continue;

    if (range.oneOf) {
      if (range.oneOf.includes(value)) out[key] = value;
      continue;
    }
    const num = Number(value);
    if (!Number.isFinite(num)) continue;
    if (num < range.min || num > range.max) continue;
    out[key] = num;
  }
  return out;
}

function readCache(appId) {
  try {
    const raw = localStorage.getItem(cacheKeyFor(appId));
    if (!raw) return null;
    const box = JSON.parse(raw);
    if (Date.now() - box.at > CACHE_TTL_MS) return null;
    return box.data;
  } catch {
    return null;
  }
}

function writeCache(appId, data) {
  try {
    localStorage.setItem(cacheKeyFor(appId), JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* переполненное хранилище не повод ронять запуск */
  }
}

/**
 * Значения для конкретной версии сборки.
 *
 * У Interier Planner под каждую версию свой ФАЙЛ (`config/v1.0.json`), потому
 * что игра там одна. У нас их одиннадцать, и файл-на-версию означал бы
 * одиннадцать умножить на число версий — поэтому версии живут ВНУТРИ файла
 * игры, в `byVersion`. Заодно исчезает догонка 404: запрос ровно один.
 */
function applyVersionOverride(doc, versionBase) {
  const flat = { ...doc };
  delete flat.tests;
  delete flat.byVersion;
  if (!versionBase || !doc.byVersion) return flat;
  const over = doc.byVersion[versionBase];
  if (!over) return flat;
  // `tests` внутри слоя версии — это тесты, а не значения: их разбирает
  // `testsFor`. Оставить их здесь значило бы завести ключ по имени «tests»,
  // который потом молча отбросит `sanitize` — то есть ошибка, видимая только
  // по отсутствию теста.
  const values = { ...over };
  delete values.tests;
  return { ...flat, ...values };
}

/**
 * Тесты, которые идут на ЭТОЙ сборке.
 *
 * Тест, привязанный к версии, лежит ВНУТРИ `byVersion[версия].tests`, а не
 * полем `version` у самого теста, и это не вкусовщина. Поле старая сборка не
 * знает — и запустила бы тест, который к ней не относится, молча и у всех, а
 * заметно это стало бы через неделю по смешанным цифрам. Вложенный тест старый
 * клиент просто НЕ ВИДИТ: он читает только `doc.tests`. То есть худшее, что
 * даёт рассинхрон версий, — тест не идёт там, где не должен.
 */
export function testsFor(doc, versionBase) {
  const own = Array.isArray(doc.tests) ? doc.tests : [];
  const scoped = versionBase ? doc.byVersion?.[versionBase]?.tests : null;
  return Array.isArray(scoped) ? [...own, ...scoped] : own;
}

/**
 * Забрать конфиг. Вызывать ОДИН раз при запуске и дожидаться — но провал сети
 * это не ошибка запуска: игра стартует на дефолтах.
 *
 * @param {object}  opts
 * @param {string}  opts.appId       — `com.terekh.hole`, он же имя файла в бакете
 * @param {object} [opts.defaults]   — если не звали `configure` заранее
 * @param {object} [opts.ranges]     — рамки: `{ key: {min,max} | {oneOf:[...]} }`
 * @param {string} [opts.versionBase] — `"1.1"`, для `byVersion`
 * @param {string} [opts.installId]  — UUID установки; из него считаются группы A/B
 * @param {string} [opts.baseUrl]    — переопределить адрес (дев-панель, тесты)
 */
export async function initRemoteConfig(opts) {
  // Не перетираем объявленное `configure`, если тут ничего не передали:
  // иначе вызов без аргументов обнулил бы дефолты игры.
  if (opts.defaults) defaults = opts.defaults;
  if (opts.ranges) ranges = opts.ranges;
  // Сбрасываем ПЕРЕД загрузкой, а не после удачи: иначе повторный вызов,
  // который не дошёл до сети, оставил бы значения прошлого — и «конфиг не
  // загрузился» выглядело бы как «загрузился», просто с чужими числами.
  values = {};
  cohorts = [];
  ready = false;

  const base = opts.baseUrl ?? CDN;
  const url = `${base}/config/${opts.appId}.json`;

  let doc = null;
  try {
    // Свой таймаут, а не таймаут браузера: у мобильной сети «отвечу через
    // сорок секунд» — обычное дело, и всё это время игра ждала бы конфиг.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: ctrl.signal, cache: "no-cache" });
      // 404 — законное состояние: у игры просто нет конфига в бакете, и это
      // означает «как в сборке», а не поломку.
      if (res.ok) doc = await res.json();
    } finally {
      clearTimeout(timer);
    }
  } catch {
    /* нет сети — ниже возьмём последний удачный ответ */
  }

  if (doc) {
    writeCache(opts.appId, doc);
  } else {
    doc = readCache(opts.appId);
  }

  if (doc) {
    const flat = applyVersionOverride(doc, opts.versionBase);
    const chosen = pickGroups(testsFor(doc, opts.versionBase), opts.installId);
    // Значения группы применяются ПОВЕРХ общих: тест и задуман как «этим
    // людям иначе, чем всем».
    values = sanitize({ ...flat, ...chosen.values });
    cohorts = chosen.groups.map(groupLabel);
    ready = true;
  }

  return rcAll();
}
