// КОПИЯ ИЗ admin/client/testBridge.js — НЕ ПРАВИТЬ ЗДЕСЬ.
// Обновляется: node tools/sync-client.mjs --write  (из папки admin)
// Правки вносить в admin/client/testBridge.js, иначе они потеряются при следующей
// синхронизации, а две копии разойдутся молча.

// Тестовый мост: то, что нужно тестировщику, и ничего, что нужно читеру.
//
// ЗАЧЕМ. Проверка на устройстве упирается не в саму проверку, а в подготовку:
// чтобы посмотреть, выйдет ли межстраничная на пятой победе, надо пять раз
// победить; чтобы проверить откат сердечек — подождать час. Руками это делается
// один раз, а нужно каждую сборку. Мост даёт те же самые действия, что дев-панель,
// но вызовом извне: агент по usb-отладке ставит параметр, сдвигает часы,
// прыгает на уровень и смотрит, что игра сделала.
//
// ПОЧЕМУ ОН И В РЕЛИЗНОЙ СБОРКЕ. Дев-панели там нет намеренно (кнопка «+5000
// монет» в опубликованном APK — дыра в экономике), а проверять релизную сборку
// всё равно надо: именно в ней вырезан дев-код, и именно там живут ошибки,
// которых нет в отладочной. Мост оставлен во всех сборках, потому что
// собственных прав он не даёт: КАЖДАЯ команда должна быть подписана приватным
// ключом, которого в APK нет (см. tools/testbridge-keys.mjs). Без подписи не
// работает ни одна, включая чтение.
//
// ЧЕГО ЭТА ЗАЩИТА НЕ ДЕЛАЕТ. Она не защищает игру от владельца устройства.
// Наши игры целиком клиентские: сейв лежит в localStorage, сервера, который
// мог бы не согласиться, нет. Кто дошёл до отладочного мостика, тот и так
// правит сейв напрямую — и вредит этим только себе. Подпись нужна ровно затем,
// чтобы у желающих не появилось ГОТОВОГО одинакового пульта на все наши игры:
// «начисли, пропусти, сбрось» одним вызовом, с описанием.
//
// Использование в игре (один раз при запуске, до первого экрана):
//
//     import { installTestBridge, registerTestActions } from "./remote/testBridge.js";
//     installTestBridge({ appId: APP_ID, versionBase: "1.1" });
//     registerTestActions({
//       "level.set": { note: "перейти на уровень", run: ({ level }) => jumpToLevel(level) },
//     });

import { TEST_BRIDGE_PUBLIC_KEY } from "./testBridgeKey.js";
import { installId } from "./abTest.js";
import {
  clearOverrides,
  initRemoteConfig,
  rcAll,
  rcCohorts,
  rcDeclaration,
  rcReady,
  rcSource,
  setOverride,
  unlockOverrides,
} from "./remoteConfig.js";

/** Версия протокола. Растёт, когда меняется форма команд или ответа. */
const PROTOCOL = 1;

/**
 * НАСТОЯЩИЕ ЧАСЫ, взятые до всякой подмены.
 *
 * Срок годности команды проверяется по ним, и только по ним. Иначе первая же
 * команда «сдвинь время на неделю» сделала бы недействительными все
 * последующие — или, что хуже, действительными просроченные.
 */
const RealDate = Date;

/** Сколько живёт одна команда. Пять минут — с запасом на медленный adb. */
const TTL_MS = 5 * 60 * 1000;

let clockOffset = 0;
let clockPatched = false;
let installed = false;
let opts = {};
let verifyKey = null;

const actions = new Map();
const seenNonces = new Set();
const NONCE_MEMORY = 200;

/** Что игра отправила в аналитику и в рекламу — кольцо последних событий. */
const captured = [];
const CAPTURE_MAX = 200;

// --------------------------------------------------------------- установка

/**
 * Поднять мост. Возвращает `false`, если в этом окружении он невозможен
 * (нет `crypto.subtle` — значит проверить подпись нечем, а без проверки моста
 * быть не должно).
 */
export function installTestBridge(options = {}) {
  if (installed) return true;
  opts = { ...options };
  if (typeof globalThis.crypto?.subtle?.verify !== "function") return false;

  captureAnalytics();
  installed = true;
  globalThis.__gameTest = {
    v: PROTOCOL,
    /** Единственное, что отвечает без подписи: «мост есть, версия такая». */
    ping: () => ({ v: PROTOCOL, appId: opts.appId ?? null }),
    run: (msg, sig) => run(msg, sig).catch((err) => ({ ok: false, error: String(err?.message ?? err) })),
  };
  return true;
}

/**
 * Объявить действия своей игры. Имя — `тема.действие`, чтобы список читался.
 *
 * Значение — функция либо `{ run, note, args }`. `note` и `args` уходят в
 * `info`: агент на другой стороне узнаёт, что у игры есть и как это звать, не
 * читая её код.
 */
export function registerTestActions(map) {
  for (const [name, def] of Object.entries(map ?? {})) {
    const entry = typeof def === "function" ? { run: def } : def;
    if (typeof entry?.run !== "function") continue;
    actions.set(name, entry);
  }
  return [...actions.keys()];
}

// ----------------------------------------------------------------- подпись

function bytes(base64) {
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function key() {
  if (verifyKey) return verifyKey;
  verifyKey = await globalThis.crypto.subtle.importKey(
    "spki",
    bytes(TEST_BRIDGE_PUBLIC_KEY),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
  return verifyKey;
}

/**
 * Проверить и выполнить.
 *
 * ПОДПИСЬ СТАВИТСЯ НА СТРОКУ, А НЕ НА РАЗОБРАННЫЙ ОБЪЕКТ, и разбираем мы её
 * ТОЛЬКО ПОСЛЕ проверки. Подпись на объекте потребовала бы, чтобы обе стороны
 * складывали ключи в одном порядке и одинаково писали числа, — а любое
 * расхождение в этом означало бы либо неработающий мост, либо, что хуже,
 * проверку не того, что исполняется.
 */
async function run(msg, sig) {
  if (typeof msg !== "string" || typeof sig !== "string") {
    return { ok: false, error: "нужны строка команды и подпись" };
  }
  let ok = false;
  try {
    ok = await globalThis.crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      await key(),
      bytes(sig),
      new TextEncoder().encode(msg),
    );
  } catch (err) {
    return { ok: false, error: `подпись не разобралась: ${err.message}` };
  }
  if (!ok) return { ok: false, error: "подпись не подходит" };

  let env;
  try {
    env = JSON.parse(msg);
  } catch {
    return { ok: false, error: "команда не разобралась" };
  }

  const now = RealDate.now();
  // Срок годности отсекает повтор старой подслушанной команды, а `nonce` —
  // повтор свежей. Нужны оба: без срока подпись годилась бы вечно, без nonce
  // одну и ту же команду можно было бы прокрутить сто раз за пять минут.
  if (!Number.isFinite(env?.exp) || env.exp < now) return { ok: false, error: "команда просрочена" };
  if (env.exp - now > TTL_MS * 2) return { ok: false, error: "срок годности слишком велик" };
  if (!env?.nonce || seenNonces.has(env.nonce)) return { ok: false, error: "команда уже выполнялась" };
  if (opts.appId && env.appId && env.appId !== opts.appId) {
    return { ok: false, error: `команда для ${env.appId}, а это ${opts.appId}` };
  }

  seenNonces.add(env.nonce);
  if (seenNonces.size > NONCE_MEMORY) seenNonces.delete(seenNonces.values().next().value);

  try {
    const result = await execute(String(env.cmd), env.args ?? {});
    return { ok: true, result: result === undefined ? null : result };
  } catch (err) {
    return { ok: false, error: String(err?.message ?? err) };
  }
}

// ----------------------------------------------------------------- команды

async function execute(cmd, args) {
  const builtin = BUILTIN[cmd];
  if (builtin) return builtin(args);

  const own = actions.get(cmd);
  if (!own) throw new Error(`нет команды «${cmd}»; список — в info`);
  return own.run(args ?? {});
}

const BUILTIN = {
  info: () => {
    const decl = rcDeclaration();
    return {
      v: PROTOCOL,
      appId: opts.appId ?? null,
      versionBase: opts.versionBase ?? null,
      release: globalThis.__BUILD_RELEASE__ === true,
      installId: safe(() => installId()),
      rcReady: rcReady(),
      cohorts: rcCohorts(),
      clockOffsetMs: clockOffset,
      params: Object.keys(decl.defaults).map((k) => ({
        key: k,
        label: decl.labels[k] ?? null,
        group: decl.groups[k] ?? null,
        range: decl.ranges[k] ?? null,
        value: rcAll()[k],
        source: rcSource(k),
      })),
      actions: [...actions.entries()].map(([name, def]) => ({
        name,
        note: def.note ?? null,
        args: def.args ?? null,
      })),
    };
  },

  "config.get": () => {
    const values = rcAll();
    return {
      ready: rcReady(),
      values,
      sources: Object.fromEntries(Object.keys(values).map((k) => [k, rcSource(k)])),
    };
  },

  /**
   * Поставить подмену. Принимает один ключ или сразу набор.
   *
   * ОТВЕЧАЕТ ПРИМЕНЁННЫМ ЗНАЧЕНИЕМ, а не «ок». Рамки могут значение не пустить
   * (`burst_count: 2.5` при целом шаге), и тогда игра осталась бы на прежнем —
   * а проверка считала бы, что параметр стоит новый.
   */
  "config.set": (args) => {
    unlockOverrides(opts.appId);
    const pairs = args?.values && typeof args.values === "object"
      ? Object.entries(args.values)
      : [[args?.key, args?.value]];
    const applied = {};
    const rejected = [];
    for (const [k, v] of pairs) {
      if (!k) continue;
      const got = setOverride(k, v);
      if (got === undefined && v !== undefined && v !== null) rejected.push(k);
      else applied[k] = got;
    }
    return { applied, rejected, values: rcAll() };
  },

  "config.clear": () => {
    unlockOverrides(opts.appId);
    clearOverrides();
    return { values: rcAll() };
  },

  /** Забрать конфиг из бакета заново — после выкладки из админки. */
  "config.reload": async () => {
    if (!opts.appId) throw new Error("мост поднят без appId");
    await initRemoteConfig({ ...opts, installId: safe(() => installId()) });
    return { ready: rcReady(), cohorts: rcCohorts(), values: rcAll() };
  },

  /**
   * Сдвинуть часы игры. Так проверяются откаты, кулдауны и суточные награды —
   * то, чего иначе приходится ЖДАТЬ.
   *
   * Подменяется `Date` целиком, а не поле в игре: игры считают время
   * `Date.now()` в двух десятках мест, и требовать от каждой отдельной ручки
   * означало бы двадцать мест, где о ней забыли. `performance.now()` не
   * подменяется намеренно — он измеряет время С ЗАПУСКА, и всё, что на нём
   * держится, обнуляется перезапуском.
   */
  "time.shift": (args) => {
    const ms = Number(args?.ms ?? 0)
      + Number(args?.sec ?? 0) * 1000
      + Number(args?.min ?? 0) * 60000
      + Number(args?.hours ?? 0) * 3600000
      + Number(args?.days ?? 0) * 86400000;
    if (!Number.isFinite(ms)) throw new Error("сдвиг не число");
    patchClock();
    clockOffset += ms;
    return clockState();
  },

  "time.reset": () => {
    clockOffset = 0;
    return clockState();
  },

  "time.get": () => clockState(),

  "app.reload": () => {
    // Отвечаем ДО перезагрузки: после неё отвечать будет некому, и вызывающий
    // получил бы обрыв связи вместо «сделано».
    setTimeout(() => globalThis.location.reload(), 50);
    return { reloading: true };
  },

  "storage.keys": () => {
    const out = [];
    for (let i = 0; i < localStorage.length; i++) out.push(localStorage.key(i));
    return out;
  },

  "storage.get": (args) => {
    const raw = localStorage.getItem(String(args?.key ?? ""));
    if (raw == null) return null;
    // Сейвы у нас — JSON. Отдаём разобранным, иначе на другой стороне пришлось
    // бы разбирать строку в строке и терять читаемость в первом же вложении.
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  },

  "storage.set": (args) => {
    const value = typeof args?.value === "string" ? args.value : JSON.stringify(args?.value);
    localStorage.setItem(String(args?.key ?? ""), value);
    return { key: args?.key, bytes: value.length };
  },

  "storage.remove": (args) => {
    localStorage.removeItem(String(args?.key ?? ""));
    return { key: args?.key };
  },

  /** Что игра отправила в аналитику и в рекламу — с начала запуска. */
  "events.tail": (args) => {
    const n = Math.max(1, Math.min(CAPTURE_MAX, Number(args?.n ?? 20)));
    const name = args?.name ? String(args.name) : null;
    const list = name ? captured.filter((e) => e.name === name) : captured;
    return list.slice(-n);
  },

  "events.clear": () => {
    captured.length = 0;
    return { cleared: true };
  },
};

function clockState() {
  return {
    offsetMs: clockOffset,
    real: new RealDate(RealDate.now()).toISOString(),
    game: new RealDate(RealDate.now() + clockOffset).toISOString(),
  };
}

/**
 * Подмена `Date`. Ставится по первой команде сдвига, а не при установке моста:
 * пока никто не просил, игра должна работать на настоящих часах.
 *
 * `Date()` БЕЗ `new` после подмены бросает исключение — так работает класс. В
 * играх такого вызова нет (проверено грепом), а `Date.now()` и `new Date()`
 * работают как надо. Снимать подмену обратно нельзя: код, уже прочитавший
 * сдвинутое время, помнит его.
 */
function patchClock() {
  if (clockPatched) return;
  clockPatched = true;
  class ShiftedDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(RealDate.now() + clockOffset);
      else super(...args);
    }
    static now() {
      return RealDate.now() + clockOffset;
    }
  }
  ShiftedDate.parse = RealDate.parse;
  ShiftedDate.UTC = RealDate.UTC;
  globalThis.Date = ShiftedDate;
}

/**
 * Ловушка на нативные мосты.
 *
 * СТАВИТСЯ НА ОБЪЕКТ, А НЕ НА МЕТОД. `window.AppMetrica` приходит из Java через
 * `addJavascriptInterface`, и присваивание его свойству молча не срабатывает:
 * после `AppMetrica.reportEvent = fn` вызовы по-прежнему уходят в нативную
 * реализацию, а ловушка остаётся пустой (проверено на устройстве). Свойство
 * самого `window` писать можно.
 */
function captureAnalytics() {
  const note = (kind, name, params) => {
    captured.push({ at: RealDate.now(), kind, name, params });
    if (captured.length > CAPTURE_MAX) captured.shift();
  };

  const wrapMetrica = () => {
    const real = globalThis.AppMetrica;
    if (!real || real.__wrapped) return Boolean(real?.__wrapped);
    globalThis.AppMetrica = {
      __wrapped: true,
      reportEvent: (name, json) => {
        note("event", name, parse(json));
        try {
          real.reportEvent(name, json);
        } catch {
          /* нативная сторона сама себе судья */
        }
      },
      reportError: (m, d) => {
        note("error", m, d);
        try {
          real.reportError(m, d);
        } catch {
          /* см. выше */
        }
      },
      setUserProfileID: (id) => {
        try {
          real.setUserProfileID(id);
        } catch {
          /* см. выше */
        }
      },
    };
    return true;
  };

  const wrapAds = () => {
    const real = globalThis.YandexAds;
    if (!real || real.__wrapped) return Boolean(real?.__wrapped);
    globalThis.YandexAds = {
      __wrapped: true,
      showInterstitial: (unit) => {
        note("ad", "interstitial", { unit });
        try {
          real.showInterstitial(unit);
        } catch {
          /* см. выше */
        }
      },
      showRewarded: (unit) => {
        note("ad", "rewarded", { unit });
        try {
          real.showRewarded(unit);
        } catch {
          /* см. выше */
        }
      },
    };
    return true;
  };

  // Мосты инжектируются до загрузки страницы, но порядок гарантировать нельзя:
  // мост игры может подняться раньше, чем WebView успел добавить интерфейс.
  // Поэтому короткая догонка, а не одна попытка.
  //
  // ОБА ВЫЗОВА БЕЗУСЛОВНЫ, и это не стиль. Здесь стояло `wrapMetrica() &&
  // wrapAds()`, и в сборке без AppMetrica первый возвращал `false` — а значит,
  // второй не звался НИ РАЗУ: реклама оставалась неперехваченной, и `events`
  // отдавал пустой список при полностью рабочей игре. Проверено на устройстве.
  // ТАЙМЕР ОБЪЯВЛЕН ДО ПЕРВОГО ВЫЗОВА, и это не стиль, а исправление аварии.
  // Здесь стояло `const timer = setInterval(...)` ПОСЛЕ `tick()`, а `tick` внутри
  // зовёт `clearInterval(timer)`. Пока хоть один мост отсутствовал, первый вызов
  // до этой строки не доходил, и всё выглядело рабочим. В сборке, где есть ОБА
  // моста (то есть в любой полной — а релизная всегда полная), первый же вызов
  // читал `timer` в мёртвой зоне: ReferenceError вылетал синхронно из
  // `installTestBridge`, и игра умирала на запуске с белым экраном.
  //
  // Поймано только на устройстве: `tsc` и `vite build` о мёртвой зоне молчат, а
  // в отладочной сборке без AppMetrica ошибка не воспроизводится вовсе.
  let timer = null;
  let done = false;
  const stop = () => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
  const tick = () => {
    const metrica = wrapMetrica();
    const ads = wrapAds();
    done = metrica && ads;
    if (done) stop();
  };

  tick();
  // Догонка нужна только если на месте не оба моста: они инжектируются до
  // загрузки страницы, но порядок гарантировать нельзя.
  if (!done) {
    timer = setInterval(tick, 100);
    setTimeout(stop, 5000);
  }
}

const parse = (json) => {
  if (typeof json !== "string") return json ?? null;
  try {
    return JSON.parse(json);
  } catch {
    return json;
  }
};

const safe = (fn) => {
  try {
    return fn();
  } catch {
    return null;
  }
};
