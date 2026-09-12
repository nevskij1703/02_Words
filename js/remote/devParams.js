// КОПИЯ ИЗ admin/client/devParams.js — НЕ ПРАВИТЬ ЗДЕСЬ.
// Обновляется: node tools/sync-client.mjs --write  (из папки admin)
// Правки вносить в admin/client/devParams.js, иначе они потеряются при следующей
// синхронизации, а две копии разойдутся молча.

// Список ВСЕХ параметров игры в дев-панели — одним куском, для любой игры.
//
// ЗАЧЕМ ОБЩИЙ КОД, А НЕ ПО ПАНЕЛИ В КАЖДОЙ ИГРЕ. Правило простое: что можно
// крутить в админке, то же должно крутиться на устройстве, и наоборот. Пять
// самописных панелей это правило не держат — параметр, добавленный в
// `remote-config.json`, появлялся бы в админке и не появлялся в игре, а узнать
// об этом можно было бы только заметив, что ползунка нет.
//
// ЗДЕСЬ ПРАВЯТСЯ ПОДМЕНЫ, А НЕ КОНФИГ. Значение уходит в локальный слой
// (`setOverride`) и живёт только на этом устройстве: дев-панель — это
// «посмотреть, как будет», а не «выложить людям». Выкладывают из админки.
//
// Подключение (ES-модули):
//
//     import { mountRcParams } from "./remote/devParams.js";
//     mountRcParams(panelElement);            // внутри дев-панели
//
// В classic-JS — `window.RemoteConfig.mountRcParams(panelElement)`.

import { paramGroups, rangeText } from "./params.js";
import { curveError, curvePreview, parseCurve } from "./curve.js";
import {
  clearOverrides,
  onRcChange,
  rcAll,
  rcDeclaration,
  rcOverrides,
  rcReady,
  rcSource,
  setOverride,
  unlockOverrides,
} from "./remoteConfig.js";

const mk = (tag, props = {}, ...kids) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "style") node.style.cssText = v;
    else if (k.startsWith("on")) node[k] = v;
    else if (v != null) node.setAttribute(k, String(v));
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return node;
};

const CSS = `
[data-rc-params]{font:13px/1.35 system-ui,sans-serif;color:#e8e8ea}
[data-rc-params] .rcp-tabs{display:flex;gap:4px;overflow-x:auto;padding:2px 0 6px;scrollbar-width:none}
[data-rc-params] .rcp-tabs::-webkit-scrollbar{display:none}
[data-rc-params] .rcp-tab{flex:0 0 auto;padding:4px 10px;border:1px solid #3a3a42;border-radius:8px;
  background:transparent;color:#9a9aa4;font:inherit;cursor:pointer;white-space:nowrap}
[data-rc-params] .rcp-tab[aria-selected="true"]{background:#2f2f38;color:#fff;font-weight:600}
[data-rc-params] .rcp-tab .rcp-dot{color:#f0b429}
[data-rc-params] .rcp-row{display:flex;align-items:center;gap:8px;padding:3px 0;border-bottom:1px solid #2a2a31}
[data-rc-params] .rcp-key{flex:1 1 auto;min-width:0;overflow-wrap:anywhere}
[data-rc-params] .rcp-key small{display:block;color:#8a8a94}
[data-rc-params] .rcp-row input,[data-rc-params] .rcp-row select{
  flex:0 0 92px;width:92px;background:#1b1b21;color:#fff;border:1px solid #3a3a42;border-radius:6px;padding:3px 6px;font:inherit}
[data-rc-params] .rcp-row.rcp-over input,[data-rc-params] .rcp-row.rcp-over select{border-color:#f0b429}
/* Кривая сложности — строка, и в 92 пикселя она не видна вовсе. Строка стоит
   под подписью, а не рядом: на телефоне рядом остаётся сантиметр. */
[data-rc-params] .rcp-row.rcp-curve{display:block}
[data-rc-params] .rcp-row.rcp-curve input{flex:none;width:100%;margin-top:4px;font-family:ui-monospace,monospace}
[data-rc-params] .rcp-x{flex:0 0 auto;width:22px;background:transparent;border:0;color:#8a8a94;cursor:pointer;font:inherit}
[data-rc-params] .rcp-head{display:flex;align-items:center;gap:8px;padding:4px 0 6px;color:#8a8a94}
[data-rc-params] .rcp-head button{background:#2f2f38;color:#fff;border:1px solid #3a3a42;border-radius:6px;padding:3px 8px;font:inherit;cursor:pointer}
`;

function styleOnce() {
  if (document.getElementById("rc-params-css")) return;
  document.head.append(mk("style", { id: "rc-params-css" }, CSS));
}

/**
 * Построить список параметров внутри `host`.
 *
 * ЗОВЁТ `unlockOverrides` САМА: панель — один из двух мест, которым подмены
 * разрешены (второе — тестовый мост). В сборке для магазина этот модуль не
 * подключён, поэтому замок там не открывает никто.
 *
 * @param {HTMLElement} host  куда вставить
 * @param {{groups?: string[], exceptGroups?: string[]}} [opts]
 *   `groups` — показать только эти темы; `exceptGroups` — все, кроме этих.
 *   Второе нужно играм, у которых часть параметров уже разложена своей панелью
 *   (у Smash Banks ползунки строятся из собственной схемы): второй список тех
 *   же ключей рядом выглядел бы как две разные настройки одного и того же.
 */
export function mountRcParams(host, opts = {}) {
  styleOnce();
  unlockOverrides();

  const box = mk("div", { "data-rc-params": "1" });
  const decl = rcDeclaration();
  const groups = paramGroups(decl).filter((g) =>
    (!opts.groups || opts.groups.includes(g.title))
    && !(opts.exceptGroups ?? []).includes(g.title));
  let active = groups.length > 1 ? null : (groups[0]?.title ?? null);

  const tabs = mk("div", { class: "rcp-tabs" });
  const head = mk("div", { class: "rcp-head" });
  const list = mk("div", {});
  box.append(head, tabs, list);
  host.append(box);

  const draw = () => {
    const over = rcOverrides();
    const values = rcAll();

    head.textContent = "";
    head.append(
      mk("span", {}, rcReady() ? "конфиг из бакета" : "конфиг не загружен, значения сборки"),
      Object.keys(over).length
        ? mk("button", { type: "button", onclick: () => clearOverrides() },
            `снять подмены (${Object.keys(over).length})`)
        : null,
    );

    tabs.textContent = "";
    if (groups.length > 1) {
      for (const g of [{ title: null }, ...groups]) {
        const mine = g.title ? groups.find((x) => x.title === g.title).keys : Object.keys(values);
        const touched = mine.some((k) => k in over);
        tabs.append(mk("button", {
          class: "rcp-tab", type: "button", "aria-selected": String(active === g.title),
          onclick: () => { active = g.title; draw(); },
        }, g.title ?? "все", touched ? mk("span", { class: "rcp-dot" }, " ●") : null));
      }
    }

    list.textContent = "";
    for (const g of groups) {
      if (active && g.title !== active) continue;
      if (!active && groups.length > 1) list.append(mk("div", { class: "rcp-head" }, g.title));
      for (const key of g.keys) list.append(row(key, decl, values, over));
    }
  };

  const stop = onRcChange(() => draw());
  draw();
  // Отписка нужна: панель у большинства игр модальная, и живёт она короче игры.
  // Без этого каждое открытие добавляло бы ещё одного слушателя на уже
  // выброшенный DOM, и правка значения обходила бы их всех по кругу.
  box.rcDispose = stop;
  return box;
}

function row(key, decl, values, over) {
  const range = decl.ranges[key] ?? {};
  const label = decl.labels[key];
  const value = values[key];
  const mine = key in over;

  const apply = (raw) => {
    const applied = setOverride(key, raw);
    // Рамки могли не пустить значение — и молчать об этом нельзя: поле
    // показывало бы одно, а игра работала бы по другому.
    if (applied === undefined && raw !== undefined) {
      input.style.borderColor = "#e5484d";
      // У кривой причина словами: «не в рамках» ничего не объясняет там, где
      // ошибиться можно десятком способов — забыть скобку, написать 12, влепить
      // два дефиса подряд.
      input.title = range.kind === "curve"
        ? (curveError(raw, range) ?? rangeText(range))
        : `не в рамках: ${rangeText(range)}`;
    }
  };

  const input = range.kind === "curve"
    ? mk("input", {
        type: "text", value: String(value ?? ""), spellcheck: "false",
        onchange: (e) => apply(e.target.value.trim() === "" ? undefined : e.target.value),
      })
    : range.oneOf
      ? mk("select", { onchange: (e) => apply(coerceOneOf(range, e.target.value)) },
          ...range.oneOf.map((o) =>
            mk("option", { value: String(o), selected: String(o) === String(value) ? "" : null }, String(o))))
      : mk("input", {
          type: "number", value: String(value ?? ""),
          min: range.min, max: range.max, step: range.step ?? 1,
          onchange: (e) => apply(e.target.value === "" ? undefined : Number(e.target.value)),
        });

  const classes = ["rcp-row"];
  if (mine) classes.push("rcp-over");
  if (range.kind === "curve") classes.push("rcp-curve");

  return mk("div", { class: classes.join(" ") },
    mk("div", { class: "rcp-key" },
      label ?? key,
      mk("small", {}, `${key} · ${rangeText(range)} · в сборке ${decl.defaults[key]}`),
      // Превью читается быстрее записи: «какой уровень получится пятым» по
      // строке со скобкой в уме считает не каждый.
      range.kind === "curve" ? mk("small", {}, previewText(value, range)) : null),
    input,
    mine
      ? mk("button", { class: "rcp-x", type: "button", title: "снять подмену", onclick: () => setOverride(key, undefined) }, "×")
      : mk("span", { class: "rcp-x" }, sourceMark(key)));
}

/** Первые уровни кривой словами: «уровни 1-10: 1 3 3 6 4 4 7 4 4 10». */
function previewText(value, range) {
  const curve = parseCurve(value, range);
  if (!curve) return "строку разобрать не удалось";
  return `уровни 1-10: ${curvePreview(curve, 10).join(" ")}`;
}

/** `oneOf` бывает и строковым (`"rotational"`), и числовым — из select приходит строка. */
function coerceOneOf(range, raw) {
  const hit = range.oneOf.find((o) => String(o) === String(raw));
  return hit === undefined ? raw : hit;
}

const sourceMark = (key) => (rcSource(key) === "remote" ? "☁" : "");
