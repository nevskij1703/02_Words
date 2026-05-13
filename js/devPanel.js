// devPanel.js — панель разработчика. Доступна через ?dev=1.
// Динамически импортируется из main.js — не попадает в production-бандл при ?dev=0.

import { generateLevel, validateLevel, placeWords, findFormableWords } from './levelGenerator.js';
import { render as renderCrossword } from './crossword.js';
import { HAND_CRAFTED_LEVELS, canFormWord } from './levels.js';
import { DICTIONARY, normalize } from './dictionary.js';
import { CONFIG } from './config.js';

const STORAGE_KEY_DEV = '02words_dev_saved_levels';

function $(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function readJsonFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return reject(new Error('файл не выбран'));
      const r = new FileReader();
      r.onload = () => {
        try { resolve(JSON.parse(r.result)); }
        catch (e) { reject(e); }
      };
      r.onerror = () => reject(r.error);
      r.readAsText(f);
    };
    input.click();
  });
}

export function mountDevPanel(app) {
  const d = CONFIG.GENERATOR_DEFAULTS;
  app.innerHTML = '';

  const panel = $(`
    <div class="dev-panel">
      <h1>🛠 Dev-панель</h1>

      <section>
        <h3 style="margin:0 0 6px">Параметры генерации</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div><label>Кол-во букв</label><input id="f-letters" type="number" min="3" max="7" value="${d.letterCount}"></div>
          <div><label>Сложность</label>
            <select id="f-diff">
              <option value="easy" ${d.difficulty==='easy'?'selected':''}>лёгкая</option>
              <option value="normal" ${d.difficulty==='normal'?'selected':''}>обычная</option>
              <option value="hard" ${d.difficulty==='hard'?'selected':''}>сложная</option>
            </select>
          </div>
          <div><label>Слов мин</label><input id="f-minw" type="number" min="2" max="8" value="${d.minWords}"></div>
          <div><label>Слов макс</label><input id="f-maxw" type="number" min="2" max="8" value="${d.maxWords}"></div>
          <div><label>Длина мин</label><input id="f-minl" type="number" min="3" max="7" value="${d.minWordLen}"></div>
          <div><label>Длина макс</label><input id="f-maxl" type="number" min="3" max="7" value="${d.maxWordLen}"></div>
        </div>
        <div style="margin-top:10px">
          <button id="btn-gen">Сгенерировать</button>
          <button id="btn-validate">Validate (текущий)</button>
          <button id="btn-validate-all">Validate all (1-20)</button>
          <button id="btn-save">Сохранить в localStorage</button>
          <button id="btn-export">Экспорт JSON</button>
          <button id="btn-import">Импорт JSON</button>
          <button id="btn-play" style="background:#2a8c52">Играть</button>
        </div>
      </section>

      <section>
        <h3 style="margin:0 0 6px">Результат</h3>
        <div id="result-info" style="margin-bottom:8px;color:#333"></div>
        <div id="result-grid"></div>
        <h4 style="margin:14px 0 4px">Основные слова</h4>
        <div id="main-words" style="font-family:monospace"></div>
        <h4 style="margin:10px 0 4px">Бонусные (из словаря)</h4>
        <div id="bonus-words" style="font-family:monospace;font-size:12px;color:#555"></div>
        <h4 style="margin:10px 0 4px">JSON</h4>
        <pre id="json-out"></pre>
      </section>

      <section>
        <h3 style="margin:0 0 6px">Сохранённые в localStorage</h3>
        <div id="saved-list"></div>
      </section>
    </div>
  `);
  app.appendChild(panel);

  const els = {
    letters: panel.querySelector('#f-letters'),
    diff: panel.querySelector('#f-diff'),
    minw: panel.querySelector('#f-minw'),
    maxw: panel.querySelector('#f-maxw'),
    minl: panel.querySelector('#f-minl'),
    maxl: panel.querySelector('#f-maxl'),
    btnGen: panel.querySelector('#btn-gen'),
    btnVal: panel.querySelector('#btn-validate'),
    btnValAll: panel.querySelector('#btn-validate-all'),
    btnSave: panel.querySelector('#btn-save'),
    btnExp: panel.querySelector('#btn-export'),
    btnImp: panel.querySelector('#btn-import'),
    btnPlay: panel.querySelector('#btn-play'),
    info: panel.querySelector('#result-info'),
    grid: panel.querySelector('#result-grid'),
    main: panel.querySelector('#main-words'),
    bonus: panel.querySelector('#bonus-words'),
    json: panel.querySelector('#json-out'),
    saved: panel.querySelector('#saved-list')
  };

  let currentLevel = null;

  function renderResult(level) {
    currentLevel = level;
    if (!level) {
      els.info.textContent = 'Не удалось сгенерировать уровень.';
      els.grid.innerHTML = '';
      els.main.textContent = '';
      els.bonus.textContent = '';
      els.json.textContent = '';
      return;
    }
    els.info.innerHTML = `<b>id=${level.id}</b> · буквы: <code>${level.letters.join('')}</code> · сетка: ${level.grid.rows}×${level.grid.cols} · основных: ${level.mainWords.length} · бонусных: ${level.bonusWords?.length || 0}`;
    els.grid.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'preview-grid';
    renderCrossword(level, wrap);
    // Сразу раскроем все ячейки — для превью.
    wrap.querySelectorAll('.cell.letter').forEach(c => { c.dataset.revealed = 'true'; });
    els.grid.appendChild(wrap);
    els.main.textContent = level.mainWords.join(', ');
    els.bonus.textContent = (level.bonusWords || []).slice(0, 100).join(', ') + ((level.bonusWords?.length || 0) > 100 ? ' …' : '');
    els.json.textContent = JSON.stringify(level, null, 2);
  }

  function refreshSavedList() {
    const arr = loadSaved();
    if (!arr.length) {
      els.saved.innerHTML = '<i style="color:#888">пока пусто</i>';
      return;
    }
    els.saved.innerHTML = '';
    arr.forEach((lv, idx) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:8px;align-items:center;padding:4px 0;border-bottom:1px solid #eee';
      row.innerHTML = `<span>#${idx + 1} ${lv.letters.join('')} → ${lv.mainWords.join(',')}</span>`;
      const btnLoad = document.createElement('button');
      btnLoad.textContent = 'Открыть';
      btnLoad.style.marginLeft = 'auto';
      btnLoad.addEventListener('click', () => renderResult(lv));
      const btnDel = document.createElement('button');
      btnDel.textContent = '×';
      btnDel.style.background = '#c44';
      btnDel.addEventListener('click', () => {
        const a = loadSaved(); a.splice(idx, 1); saveAll(a); refreshSavedList();
      });
      row.appendChild(btnLoad);
      row.appendChild(btnDel);
      els.saved.appendChild(row);
    });
    // Кнопка «Экспорт всего».
    const btnAll = document.createElement('button');
    btnAll.textContent = `Экспорт всего (${arr.length})`;
    btnAll.style.marginTop = '8px';
    btnAll.addEventListener('click', () => downloadJson(arr, 'levels_export.json'));
    els.saved.appendChild(btnAll);

    // Кнопка «Сгенерировать как levels.generated.js».
    const btnGen = document.createElement('button');
    btnGen.textContent = 'Скачать как levels.generated.js';
    btnGen.style.marginLeft = '8px';
    btnGen.addEventListener('click', () => {
      const js = `// Auto-generated by devPanel. Do not edit by hand — regenerate via ?dev=1.\nexport const GENERATED_LEVELS = ${JSON.stringify(arr, null, 2)};\n`;
      const blob = new Blob([js], { type: 'text/javascript' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'levels.generated.js'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    els.saved.appendChild(btnGen);
  }

  function loadSaved() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY_DEV) || '[]'); }
    catch { return []; }
  }
  function saveAll(arr) { localStorage.setItem(STORAGE_KEY_DEV, JSON.stringify(arr)); }

  // === Обработчики ===

  els.btnGen.addEventListener('click', () => {
    const opts = {
      letterCount: parseInt(els.letters.value, 10),
      minWords:    parseInt(els.minw.value, 10),
      maxWords:    parseInt(els.maxw.value, 10),
      minWordLen:  parseInt(els.minl.value, 10),
      maxWordLen:  parseInt(els.maxl.value, 10),
      difficulty:  els.diff.value,
      id:          Date.now()
    };
    const lvl = generateLevel(opts);
    renderResult(lvl);
  });

  els.btnVal.addEventListener('click', () => {
    if (!currentLevel) { alert('Сначала сгенерируйте уровень.'); return; }
    const v = validateLevel(currentLevel);
    alert(v.ok ? '✅ OK' : '❌ Ошибки:\n' + v.errors.join('\n'));
  });

  els.btnValAll.addEventListener('click', () => {
    const errs = [];
    for (const lv of HAND_CRAFTED_LEVELS) {
      const v = validateLevel(lv);
      if (!v.ok) errs.push(`L${lv.id}: ${v.errors.join('; ')}`);
    }
    alert(errs.length ? '❌\n' + errs.join('\n') : `✅ Все ${HAND_CRAFTED_LEVELS.length} уровней валидны`);
  });

  els.btnSave.addEventListener('click', () => {
    if (!currentLevel) { alert('Сначала сгенерируйте уровень.'); return; }
    const v = validateLevel(currentLevel);
    if (!v.ok) { if (!confirm('Уровень невалиден. Сохранить всё равно?')) return; }
    const arr = loadSaved();
    arr.push(currentLevel);
    saveAll(arr);
    refreshSavedList();
  });

  els.btnExp.addEventListener('click', () => {
    if (!currentLevel) { alert('Сначала сгенерируйте уровень.'); return; }
    downloadJson(currentLevel, `level_${currentLevel.id}.json`);
  });

  els.btnImp.addEventListener('click', async () => {
    try {
      const data = await readJsonFile();
      // Может быть либо отдельный уровень, либо массив.
      if (Array.isArray(data)) {
        const arr = loadSaved();
        for (const lv of data) arr.push(lv);
        saveAll(arr);
        refreshSavedList();
        alert(`Импортировано ${data.length} уровней в localStorage.`);
      } else {
        renderResult(data);
      }
    } catch (e) { alert('Ошибка импорта: ' + e.message); }
  });

  els.btnPlay.addEventListener('click', () => {
    location.href = location.pathname;
  });

  refreshSavedList();
}
