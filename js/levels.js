// levels.js — основные 20 уровней игры.
//
// Все уровни созданы через генератор (см. scripts/generate_levels.mjs) и
// прогнаны через validateLevel. Каждый имеет:
//   - центральное слово длиной ≥ 5 букв (самое длинное)
//   - кроссворд из 5-12 связанных слов
//
// bonusWords автоматически вычисляются из словаря в populateBonus.

import { DICTIONARY, normalize } from './dictionary.js';

export function canFormWord(word, letters) {
  const pool = new Map();
  for (const ch of letters) pool.set(ch, (pool.get(ch) || 0) + 1);
  for (const ch of word) {
    const cnt = pool.get(ch) || 0;
    if (cnt === 0) return false;
    pool.set(ch, cnt - 1);
  }
  return true;
}

function populateBonus(level) {
  const lettersNorm = level.letters.map(normalize);
  const main = new Set(level.mainWords.map(normalize));
  const bonus = [];
  for (const w of DICTIONARY) {
    if (w.length < 3) continue;
    if (main.has(w)) continue;
    if (canFormWord(w, lettersNorm)) bonus.push(w);
  }
  return { ...level, bonusWords: bonus };
}

const RAW = [
  {
    "id": 1,
    "letters": [
      "Т",
      "Н",
      "Р",
      "О",
      "Е"
    ],
    "mainWords": [
      "ТЕНОР",
      "ТРОН",
      "РОТ",
      "ТОН",
      "ЕНОТ",
      "ТЕРН",
      "ТОР"
    ],
    "bonusWords": [],
    "grid": {
      "rows": 6,
      "cols": 8
    },
    "placements": [
      {
        "word": "ТЕНОР",
        "row": 2,
        "col": 2,
        "direction": "horizontal"
      },
      {
        "word": "ТРОН",
        "row": 0,
        "col": 5,
        "direction": "vertical"
      },
      {
        "word": "РОТ",
        "row": 0,
        "col": 2,
        "direction": "vertical"
      },
      {
        "word": "ТОН",
        "row": 0,
        "col": 5,
        "direction": "horizontal"
      },
      {
        "word": "ЕНОТ",
        "row": 2,
        "col": 3,
        "direction": "vertical"
      },
      {
        "word": "ТЕРН",
        "row": 0,
        "col": 0,
        "direction": "horizontal"
      },
      {
        "word": "ТОР",
        "row": 0,
        "col": 0,
        "direction": "vertical"
      }
    ]
  },
  {
    "id": 2,
    "letters": [
      "П",
      "А",
      "Е",
      "Л",
      "Н"
    ],
    "mainWords": [
      "НЕПАЛ",
      "ПЕНАЛ",
      "ПЛЕН",
      "ПЕНА",
      "ПЛАН",
      "ЛЕНА"
    ],
    "bonusWords": [],
    "grid": {
      "rows": 8,
      "cols": 7
    },
    "placements": [
      {
        "word": "НЕПАЛ",
        "row": 3,
        "col": 1,
        "direction": "horizontal"
      },
      {
        "word": "ПЕНАЛ",
        "row": 3,
        "col": 3,
        "direction": "vertical"
      },
      {
        "word": "ПЛЕН",
        "row": 0,
        "col": 1,
        "direction": "vertical"
      },
      {
        "word": "ПЕНА",
        "row": 5,
        "col": 1,
        "direction": "horizontal"
      },
      {
        "word": "ПЛАН",
        "row": 1,
        "col": 0,
        "direction": "horizontal"
      },
      {
        "word": "ЛЕНА",
        "row": 7,
        "col": 3,
        "direction": "horizontal"
      }
    ]
  },
  {
    "id": 3,
    "letters": [
      "А",
      "К",
      "Ч",
      "Т",
      "О"
    ],
    "mainWords": [
      "ТОЧКА",
      "ТОК",
      "ТКАЧ",
      "ЧТО",
      "КОТ",
      "АКТ"
    ],
    "bonusWords": [],
    "grid": {
      "rows": 6,
      "cols": 7
    },
    "placements": [
      {
        "word": "ТОЧКА",
        "row": 3,
        "col": 2,
        "direction": "horizontal"
      },
      {
        "word": "ТОК",
        "row": 3,
        "col": 2,
        "direction": "vertical"
      },
      {
        "word": "ТКАЧ",
        "row": 0,
        "col": 4,
        "direction": "vertical"
      },
      {
        "word": "ЧТО",
        "row": 4,
        "col": 0,
        "direction": "horizontal"
      },
      {
        "word": "КОТ",
        "row": 0,
        "col": 2,
        "direction": "horizontal"
      },
      {
        "word": "АКТ",
        "row": 3,
        "col": 6,
        "direction": "vertical"
      }
    ]
  },
  {
    "id": 4,
    "letters": [
      "О",
      "Т",
      "А",
      "К",
      "П"
    ],
    "mainWords": [
      "ТАПОК",
      "ПОТ",
      "ТОК",
      "ПАК",
      "КОТ",
      "АКТ"
    ],
    "bonusWords": [],
    "grid": {
      "rows": 5,
      "cols": 7
    },
    "placements": [
      {
        "word": "ТАПОК",
        "row": 0,
        "col": 2,
        "direction": "horizontal"
      },
      {
        "word": "ПОТ",
        "row": 0,
        "col": 4,
        "direction": "vertical"
      },
      {
        "word": "ТОК",
        "row": 0,
        "col": 2,
        "direction": "vertical"
      },
      {
        "word": "ПАК",
        "row": 2,
        "col": 0,
        "direction": "horizontal"
      },
      {
        "word": "КОТ",
        "row": 0,
        "col": 6,
        "direction": "vertical"
      },
      {
        "word": "АКТ",
        "row": 2,
        "col": 1,
        "direction": "vertical"
      }
    ]
  },
  {
    "id": 5,
    "letters": [
      "И",
      "А",
      "С",
      "Н",
      "О"
    ],
    "mainWords": [
      "ОСИНА",
      "САНИ",
      "СОН",
      "ОСА",
      "НОС"
    ],
    "bonusWords": [],
    "grid": {
      "rows": 6,
      "cols": 6
    },
    "placements": [
      {
        "word": "ОСИНА",
        "row": 2,
        "col": 1,
        "direction": "horizontal"
      },
      {
        "word": "САНИ",
        "row": 2,
        "col": 2,
        "direction": "vertical"
      },
      {
        "word": "СОН",
        "row": 4,
        "col": 0,
        "direction": "horizontal"
      },
      {
        "word": "ОСА",
        "row": 0,
        "col": 5,
        "direction": "vertical"
      },
      {
        "word": "НОС",
        "row": 2,
        "col": 4,
        "direction": "vertical"
      }
    ]
  },
  {
    "id": 6,
    "letters": [
      "О",
      "И",
      "С",
      "Ч",
      "Т"
    ],
    "mainWords": [
      "ЧИСТО",
      "СИТО",
      "СТО",
      "СОТ",
      "ЧТО",
      "ОСТ"
    ],
    "bonusWords": [],
    "grid": {
      "rows": 7,
      "cols": 7
    },
    "placements": [
      {
        "word": "ЧИСТО",
        "row": 4,
        "col": 0,
        "direction": "horizontal"
      },
      {
        "word": "СИТО",
        "row": 3,
        "col": 1,
        "direction": "vertical"
      },
      {
        "word": "СТО",
        "row": 2,
        "col": 4,
        "direction": "vertical"
      },
      {
        "word": "СОТ",
        "row": 2,
        "col": 4,
        "direction": "horizontal"
      },
      {
        "word": "ЧТО",
        "row": 0,
        "col": 5,
        "direction": "vertical"
      },
      {
        "word": "ОСТ",
        "row": 6,
        "col": 1,
        "direction": "horizontal"
      }
    ]
  },
  {
    "id": 7,
    "letters": [
      "О",
      "Р",
      "С",
      "Т",
      "О"
    ],
    "mainWords": [
      "ТОРОС",
      "СТО",
      "РОТ",
      "СОР",
      "ТОР",
      "ТОРС",
      "РОСТ",
      "ТРОС",
      "СОРТ"
    ],
    "bonusWords": [
      "СОТ",
      "ОСТ"
    ],
    "grid": {
      "rows": 7,
      "cols": 9
    },
    "placements": [
      {
        "word": "ТОРОС",
        "row": 2,
        "col": 2,
        "direction": "horizontal"
      },
      {
        "word": "СТО",
        "row": 2,
        "col": 6,
        "direction": "vertical"
      },
      {
        "word": "РОТ",
        "row": 0,
        "col": 2,
        "direction": "vertical"
      },
      {
        "word": "СОР",
        "row": 0,
        "col": 0,
        "direction": "horizontal"
      },
      {
        "word": "ТОР",
        "row": 3,
        "col": 6,
        "direction": "horizontal"
      },
      {
        "word": "ТОРС",
        "row": 0,
        "col": 4,
        "direction": "vertical"
      },
      {
        "word": "РОСТ",
        "row": 3,
        "col": 8,
        "direction": "vertical"
      },
      {
        "word": "ТРОС",
        "row": 0,
        "col": 4,
        "direction": "horizontal"
      },
      {
        "word": "СОРТ",
        "row": 6,
        "col": 5,
        "direction": "horizontal"
      }
    ]
  },
  {
    "id": 8,
    "letters": [
      "А",
      "С",
      "Н",
      "И",
      "О"
    ],
    "mainWords": [
      "ОСИНА",
      "НОС",
      "ОСА",
      "СОН",
      "САНИ"
    ],
    "bonusWords": [],
    "grid": {
      "rows": 3,
      "cols": 8
    },
    "placements": [
      {
        "word": "ОСИНА",
        "row": 2,
        "col": 1,
        "direction": "horizontal"
      },
      {
        "word": "НОС",
        "row": 0,
        "col": 2,
        "direction": "vertical"
      },
      {
        "word": "ОСА",
        "row": 0,
        "col": 5,
        "direction": "vertical"
      },
      {
        "word": "СОН",
        "row": 1,
        "col": 5,
        "direction": "horizontal"
      },
      {
        "word": "САНИ",
        "row": 0,
        "col": 0,
        "direction": "horizontal"
      }
    ]
  },
  {
    "id": 9,
    "letters": [
      "Е",
      "А",
      "П",
      "Н",
      "Л"
    ],
    "mainWords": [
      "НЕПАЛ",
      "ЛЕНА",
      "ПЛАН",
      "ПЕНА",
      "ПЛЕН",
      "ПЕНАЛ"
    ],
    "bonusWords": [],
    "grid": {
      "rows": 7,
      "cols": 9
    },
    "placements": [
      {
        "word": "НЕПАЛ",
        "row": 4,
        "col": 0,
        "direction": "horizontal"
      },
      {
        "word": "ЛЕНА",
        "row": 3,
        "col": 1,
        "direction": "vertical"
      },
      {
        "word": "ПЛАН",
        "row": 3,
        "col": 4,
        "direction": "vertical"
      },
      {
        "word": "ПЕНА",
        "row": 3,
        "col": 4,
        "direction": "horizontal"
      },
      {
        "word": "ПЛЕН",
        "row": 0,
        "col": 6,
        "direction": "vertical"
      },
      {
        "word": "ПЕНАЛ",
        "row": 3,
        "col": 4,
        "direction": "horizontal"
      }
    ]
  },
  {
    "id": 10,
    "letters": [
      "Е",
      "А",
      "П",
      "Р",
      "К"
    ],
    "mainWords": [
      "РЕПКА",
      "РЕКА",
      "КАРП",
      "ПАЕК",
      "ПАР",
      "РАК",
      "ПАК",
      "ПАРК"
    ],
    "bonusWords": [],
    "grid": {
      "rows": 8,
      "cols": 6
    },
    "placements": [
      {
        "word": "РЕПКА",
        "row": 3,
        "col": 0,
        "direction": "horizontal"
      },
      {
        "word": "РЕКА",
        "row": 2,
        "col": 1,
        "direction": "vertical"
      },
      {
        "word": "КАРП",
        "row": 5,
        "col": 0,
        "direction": "horizontal"
      },
      {
        "word": "ПАЕК",
        "row": 0,
        "col": 3,
        "direction": "vertical"
      },
      {
        "word": "ПАР",
        "row": 1,
        "col": 2,
        "direction": "horizontal"
      },
      {
        "word": "РАК",
        "row": 5,
        "col": 2,
        "direction": "vertical"
      },
      {
        "word": "ПАК",
        "row": 7,
        "col": 0,
        "direction": "horizontal"
      },
      {
        "word": "ПАРК",
        "row": 1,
        "col": 2,
        "direction": "horizontal"
      }
    ]
  },
  {
    "id": 11,
    "letters": [
      "А",
      "Ц",
      "М",
      "О",
      "Л",
      "С"
    ],
    "mainWords": [
      "МАСЛО",
      "СМОЛА",
      "МОЛ",
      "ОСА",
      "САЛО",
      "МАЛО",
      "САМ",
      "ЛОМ"
    ],
    "bonusWords": [],
    "grid": {
      "rows": 8,
      "cols": 5
    },
    "placements": [
      {
        "word": "МАСЛО",
        "row": 4,
        "col": 0,
        "direction": "horizontal"
      },
      {
        "word": "СМОЛА",
        "row": 0,
        "col": 1,
        "direction": "vertical"
      },
      {
        "word": "МОЛ",
        "row": 3,
        "col": 4,
        "direction": "vertical"
      },
      {
        "word": "ОСА",
        "row": 2,
        "col": 1,
        "direction": "horizontal"
      },
      {
        "word": "САЛО",
        "row": 0,
        "col": 1,
        "direction": "horizontal"
      },
      {
        "word": "МАЛО",
        "row": 4,
        "col": 0,
        "direction": "vertical"
      },
      {
        "word": "САМ",
        "row": 4,
        "col": 2,
        "direction": "vertical"
      },
      {
        "word": "ЛОМ",
        "row": 6,
        "col": 0,
        "direction": "horizontal"
      }
    ]
  },
  {
    "id": 12,
    "letters": [
      "Е",
      "К",
      "Т",
      "А",
      "В",
      "Р"
    ],
    "mainWords": [
      "АКТЕР",
      "ВЕТКА",
      "РАК",
      "ТРАК",
      "ВЕРА",
      "РЕВ",
      "АКТ",
      "РЕКА",
      "КАТЕР",
      "ВАР",
      "ВЕК",
      "КЕТА"
    ],
    "bonusWords": [],
    "grid": {
      "rows": 11,
      "cols": 9
    },
    "placements": [
      {
        "word": "АКТЕР",
        "row": 3,
        "col": 2,
        "direction": "horizontal"
      },
      {
        "word": "ВЕТКА",
        "row": 2,
        "col": 5,
        "direction": "vertical"
      },
      {
        "word": "РАК",
        "row": 5,
        "col": 3,
        "direction": "horizontal"
      },
      {
        "word": "ТРАК",
        "row": 5,
        "col": 2,
        "direction": "horizontal"
      },
      {
        "word": "ВЕРА",
        "row": 0,
        "col": 2,
        "direction": "vertical"
      },
      {
        "word": "РЕВ",
        "row": 0,
        "col": 0,
        "direction": "horizontal"
      },
      {
        "word": "АКТ",
        "row": 6,
        "col": 5,
        "direction": "horizontal"
      },
      {
        "word": "РЕКА",
        "row": 0,
        "col": 0,
        "direction": "vertical"
      },
      {
        "word": "КАТЕР",
        "row": 4,
        "col": 7,
        "direction": "vertical"
      },
      {
        "word": "ВАР",
        "row": 8,
        "col": 5,
        "direction": "horizontal"
      },
      {
        "word": "ВЕК",
        "row": 8,
        "col": 5,
        "direction": "vertical"
      },
      {
        "word": "КЕТА",
        "row": 10,
        "col": 5,
        "direction": "horizontal"
      }
    ]
  },
  {
    "id": 13,
    "letters": [
      "О",
      "Е",
      "Л",
      "В",
      "П",
      "Т"
    ],
    "mainWords": [
      "ПОЛЕТ",
      "ЛОТ",
      "ЛЕТО",
      "ЛОВ",
      "ТЕПЛО",
      "ПЛОВ",
      "ПЛОТ",
      "ПОЛЕ",
      "ТЕЛО",
      "ВОЛ",
      "ЛЕТ",
      "ЛЕВ"
    ],
    "bonusWords": [
      "ПОЛ",
      "ПОТ"
    ],
    "grid": {
      "rows": 9,
      "cols": 10
    },
    "placements": [
      {
        "word": "ПОЛЕТ",
        "row": 4,
        "col": 3,
        "direction": "horizontal"
      },
      {
        "word": "ЛОТ",
        "row": 2,
        "col": 7,
        "direction": "vertical"
      },
      {
        "word": "ЛЕТО",
        "row": 4,
        "col": 5,
        "direction": "vertical"
      },
      {
        "word": "ЛОВ",
        "row": 2,
        "col": 7,
        "direction": "horizontal"
      },
      {
        "word": "ТЕПЛО",
        "row": 2,
        "col": 3,
        "direction": "vertical"
      },
      {
        "word": "ПЛОВ",
        "row": 2,
        "col": 6,
        "direction": "horizontal"
      },
      {
        "word": "ПЛОТ",
        "row": 1,
        "col": 7,
        "direction": "vertical"
      },
      {
        "word": "ПОЛЕ",
        "row": 3,
        "col": 0,
        "direction": "horizontal"
      },
      {
        "word": "ТЕЛО",
        "row": 6,
        "col": 0,
        "direction": "horizontal"
      },
      {
        "word": "ВОЛ",
        "row": 2,
        "col": 1,
        "direction": "vertical"
      },
      {
        "word": "ЛЕТ",
        "row": 6,
        "col": 2,
        "direction": "vertical"
      },
      {
        "word": "ЛЕВ",
        "row": 0,
        "col": 9,
        "direction": "vertical"
      }
    ]
  },
  {
    "id": 14,
    "letters": [
      "А",
      "М",
      "Д",
      "П",
      "А",
      "Р"
    ],
    "mainWords": [
      "ДРАМА",
      "ДРАП",
      "ДАР",
      "ДАМА",
      "ПАРАД",
      "ПАР",
      "ПАРА",
      "РАМА"
    ],
    "bonusWords": [],
    "grid": {
      "rows": 7,
      "cols": 10
    },
    "placements": [
      {
        "word": "ДРАМА",
        "row": 4,
        "col": 0,
        "direction": "horizontal"
      },
      {
        "word": "ДРАП",
        "row": 3,
        "col": 1,
        "direction": "vertical"
      },
      {
        "word": "ДАР",
        "row": 3,
        "col": 4,
        "direction": "vertical"
      },
      {
        "word": "ДАМА",
        "row": 3,
        "col": 4,
        "direction": "horizontal"
      },
      {
        "word": "ПАРАД",
        "row": 2,
        "col": 7,
        "direction": "vertical"
      },
      {
        "word": "ПАР",
        "row": 5,
        "col": 6,
        "direction": "horizontal"
      },
      {
        "word": "ПАРА",
        "row": 5,
        "col": 6,
        "direction": "horizontal"
      },
      {
        "word": "РАМА",
        "row": 0,
        "col": 5,
        "direction": "vertical"
      }
    ]
  },
  {
    "id": 15,
    "letters": [
      "Е",
      "Т",
      "И",
      "Л",
      "П",
      "Р"
    ],
    "mainWords": [
      "ПРИЛЕТ",
      "ПИР",
      "ТИР",
      "ПЕРЛ",
      "ТИРЕ",
      "ТИП",
      "ЛЕТ",
      "ЛИТР"
    ],
    "bonusWords": [],
    "grid": {
      "rows": 8,
      "cols": 8
    },
    "placements": [
      {
        "word": "ПРИЛЕТ",
        "row": 4,
        "col": 1,
        "direction": "horizontal"
      },
      {
        "word": "ПИР",
        "row": 2,
        "col": 2,
        "direction": "vertical"
      },
      {
        "word": "ТИР",
        "row": 4,
        "col": 6,
        "direction": "vertical"
      },
      {
        "word": "ПЕРЛ",
        "row": 4,
        "col": 1,
        "direction": "vertical"
      },
      {
        "word": "ТИРЕ",
        "row": 6,
        "col": 4,
        "direction": "horizontal"
      },
      {
        "word": "ТИП",
        "row": 2,
        "col": 0,
        "direction": "horizontal"
      },
      {
        "word": "ЛЕТ",
        "row": 4,
        "col": 4,
        "direction": "vertical"
      },
      {
        "word": "ЛИТР",
        "row": 0,
        "col": 0,
        "direction": "vertical"
      }
    ]
  },
  {
    "id": 16,
    "letters": [
      "А",
      "Р",
      "С",
      "К",
      "И",
      "Л"
    ],
    "mainWords": [
      "ИСКРА",
      "ЛИС",
      "ЛАК",
      "ЛИРА",
      "РИС",
      "РАК",
      "САК",
      "КИСА",
      "ИКРА",
      "СИЛА",
      "ЛИСА",
      "ЛИК"
    ],
    "bonusWords": [
      "СИР"
    ],
    "grid": {
      "rows": 8,
      "cols": 10
    },
    "placements": [
      {
        "word": "ИСКРА",
        "row": 3,
        "col": 0,
        "direction": "horizontal"
      },
      {
        "word": "ЛИС",
        "row": 2,
        "col": 0,
        "direction": "vertical"
      },
      {
        "word": "ЛАК",
        "row": 1,
        "col": 2,
        "direction": "vertical"
      },
      {
        "word": "ЛИРА",
        "row": 1,
        "col": 2,
        "direction": "horizontal"
      },
      {
        "word": "РИС",
        "row": 3,
        "col": 3,
        "direction": "vertical"
      },
      {
        "word": "РАК",
        "row": 0,
        "col": 5,
        "direction": "vertical"
      },
      {
        "word": "САК",
        "row": 5,
        "col": 3,
        "direction": "horizontal"
      },
      {
        "word": "КИСА",
        "row": 2,
        "col": 5,
        "direction": "horizontal"
      },
      {
        "word": "ИКРА",
        "row": 4,
        "col": 5,
        "direction": "vertical"
      },
      {
        "word": "СИЛА",
        "row": 2,
        "col": 7,
        "direction": "vertical"
      },
      {
        "word": "ЛИСА",
        "row": 7,
        "col": 2,
        "direction": "horizontal"
      },
      {
        "word": "ЛИК",
        "row": 4,
        "col": 7,
        "direction": "horizontal"
      }
    ]
  },
  {
    "id": 17,
    "letters": [
      "И",
      "Н",
      "Т",
      "К",
      "Р",
      "Е"
    ],
    "mainWords": [
      "ИНТЕР",
      "ТИР",
      "ТЕРН",
      "ТИРЕ",
      "КИТ",
      "КРЕН",
      "ТИК"
    ],
    "bonusWords": [],
    "grid": {
      "rows": 8,
      "cols": 5
    },
    "placements": [
      {
        "word": "ИНТЕР",
        "row": 4,
        "col": 0,
        "direction": "horizontal"
      },
      {
        "word": "ТИР",
        "row": 4,
        "col": 2,
        "direction": "vertical"
      },
      {
        "word": "ТЕРН",
        "row": 2,
        "col": 4,
        "direction": "vertical"
      },
      {
        "word": "ТИРЕ",
        "row": 4,
        "col": 2,
        "direction": "vertical"
      },
      {
        "word": "КИТ",
        "row": 2,
        "col": 2,
        "direction": "horizontal"
      },
      {
        "word": "КРЕН",
        "row": 7,
        "col": 0,
        "direction": "horizontal"
      },
      {
        "word": "ТИК",
        "row": 0,
        "col": 2,
        "direction": "vertical"
      }
    ]
  },
  {
    "id": 18,
    "letters": [
      "О",
      "О",
      "Й",
      "М",
      "Т",
      "Р"
    ],
    "mainWords": [
      "МОТОР",
      "ТОР",
      "ТОМ",
      "РОТ",
      "МОТО",
      "МОР",
      "РОЙ"
    ],
    "bonusWords": [],
    "grid": {
      "rows": 5,
      "cols": 8
    },
    "placements": [
      {
        "word": "МОТОР",
        "row": 2,
        "col": 3,
        "direction": "horizontal"
      },
      {
        "word": "ТОР",
        "row": 2,
        "col": 5,
        "direction": "vertical"
      },
      {
        "word": "ТОМ",
        "row": 0,
        "col": 3,
        "direction": "vertical"
      },
      {
        "word": "РОТ",
        "row": 2,
        "col": 7,
        "direction": "vertical"
      },
      {
        "word": "МОТО",
        "row": 1,
        "col": 0,
        "direction": "horizontal"
      },
      {
        "word": "МОР",
        "row": 1,
        "col": 0,
        "direction": "vertical"
      },
      {
        "word": "РОЙ",
        "row": 3,
        "col": 0,
        "direction": "horizontal"
      }
    ]
  },
  {
    "id": 19,
    "letters": [
      "Д",
      "К",
      "Е",
      "А",
      "С",
      "Л"
    ],
    "mainWords": [
      "СКЛАД",
      "ЕДА",
      "ЛЕД",
      "САК",
      "СЛЕД",
      "ЛЕС",
      "ЛАК",
      "ЕЛКА",
      "САД",
      "КЛАД"
    ],
    "bonusWords": [],
    "grid": {
      "rows": 9,
      "cols": 9
    },
    "placements": [
      {
        "word": "СКЛАД",
        "row": 4,
        "col": 4,
        "direction": "horizontal"
      },
      {
        "word": "ЕДА",
        "row": 2,
        "col": 7,
        "direction": "vertical"
      },
      {
        "word": "ЛЕД",
        "row": 2,
        "col": 6,
        "direction": "horizontal"
      },
      {
        "word": "САК",
        "row": 4,
        "col": 4,
        "direction": "vertical"
      },
      {
        "word": "СЛЕД",
        "row": 2,
        "col": 5,
        "direction": "horizontal"
      },
      {
        "word": "ЛЕС",
        "row": 4,
        "col": 6,
        "direction": "vertical"
      },
      {
        "word": "ЛАК",
        "row": 6,
        "col": 2,
        "direction": "horizontal"
      },
      {
        "word": "ЕЛКА",
        "row": 5,
        "col": 2,
        "direction": "vertical"
      },
      {
        "word": "САД",
        "row": 0,
        "col": 8,
        "direction": "vertical"
      },
      {
        "word": "КЛАД",
        "row": 8,
        "col": 0,
        "direction": "horizontal"
      }
    ]
  },
  {
    "id": 20,
    "letters": [
      "Й",
      "Е",
      "К",
      "Т",
      "А",
      "М"
    ],
    "mainWords": [
      "МЕТКА",
      "МАК",
      "МАЙ",
      "КЕТА",
      "ТЕМА",
      "МАТ",
      "АКТ"
    ],
    "bonusWords": [],
    "grid": {
      "rows": 5,
      "cols": 8
    },
    "placements": [
      {
        "word": "МЕТКА",
        "row": 2,
        "col": 3,
        "direction": "horizontal"
      },
      {
        "word": "МАК",
        "row": 2,
        "col": 3,
        "direction": "vertical"
      },
      {
        "word": "МАЙ",
        "row": 1,
        "col": 7,
        "direction": "vertical"
      },
      {
        "word": "КЕТА",
        "row": 0,
        "col": 5,
        "direction": "vertical"
      },
      {
        "word": "ТЕМА",
        "row": 3,
        "col": 0,
        "direction": "horizontal"
      },
      {
        "word": "МАТ",
        "row": 1,
        "col": 0,
        "direction": "vertical"
      },
      {
        "word": "АКТ",
        "row": 0,
        "col": 4,
        "direction": "horizontal"
      }
    ]
  }
];

export const HAND_CRAFTED_LEVELS = RAW.map(populateBonus);
