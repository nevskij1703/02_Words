// cells.js — изолированная персистенция открытых ячеек текущего уровня.
//
// Зачем отдельный модуль вместо хелперов в storage.js: storage.js был у
// многих пользователей закэширован в браузере/WebView в старой версии
// без новых функций (add/get/clearRevealedCells). Guard в ui.js просто
// пропускал вызовы — данные не писались. Новый файл cells.js никем
// ранее не запрашивался, поэтому первая же загрузка получает свежую
// реализацию.
//
// Хранится под отдельным ключом 02words_revealed_cells, не пересекается
// со схемой 02words_save.

const KEY = '02words_revealed_cells';

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); }
  catch { return {}; }
}

function write(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
}

export function getCells(levelId) {
  const arr = read()[levelId];
  return Array.isArray(arr) ? arr : [];
}

export function addCell(levelId, row, col) {
  const data = read();
  if (!data[levelId]) data[levelId] = [];
  const list = data[levelId];
  if (!list.some(c => c[0] === row && c[1] === col)) {
    list.push([row, col]);
    write(data);
  }
}

export function clearCells(levelId) {
  const data = read();
  if (data[levelId]) {
    delete data[levelId];
    write(data);
  }
}

// Полный сброс всех записей (для cheat-reset). Также используется
// storage.reset() — но т.к. storage у юзеров мог быть закэширован,
// добавляем явный путь.
export function clearAll() {
  try { localStorage.removeItem(KEY); } catch {}
}
