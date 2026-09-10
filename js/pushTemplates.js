// pushTemplates.js — шаблоны push-уведомлений для «Слова из букв».
//
// Тон: бодрый, образовательный, лёгкая игривость.
// Аудитория: любители тренировки мозга, scrabble-фаны, обедающие в офисе.
//
// Каждый шаблон: { id, slot, weekdays, title, body, cooldownDays, requires?, weight? }
// Подключается через ES-import в js/main.js → передаётся в PushScheduler.configure.

export const PUSH_TEMPLATES = [
  // ===== Утро (09:00-10:30) — разминка мозга =====
  {
    id: 'morning-brain-warmup',
    slot: 'morning', weekdays: 'any',
    title: '🧠 Утренняя разминка',
    body: '5 слов за 5 минут — мозг проснётся быстрее кофе',
    cooldownDays: 3
  },
  {
    id: 'morning-letters-wait',
    slot: 'morning', weekdays: 'any',
    title: '📖 Новые буквы ждут',
    body: 'Сложишь сегодня все слова из набора?',
    cooldownDays: 3
  },
  {
    id: 'morning-weekend-puzzle',
    slot: 'morning', weekdays: 'weekend',
    title: '🌅 Воскресная порция букв',
    body: 'Лёгкое утро + сложные слова = идеально',
    cooldownDays: 7
  },

  // ===== Обед (13:00-14:00) — быстрая партия =====
  {
    id: 'lunch-10-words',
    slot: 'lunch', weekdays: 'any',
    title: '🥪 Найди 10 слов за обед',
    body: 'Полезный перерыв на работе',
    cooldownDays: 3
  },
  {
    id: 'lunch-coffee-words',
    slot: 'lunch', weekdays: 'weekday',
    title: '☕ Кофе + слова = идеально',
    body: 'Быстрая партия — мозг не спит',
    cooldownDays: 4
  },
  {
    id: 'lunch-challenge-7letters',
    slot: 'lunch', weekdays: 'any',
    title: '🤓 Сможешь 20 слов из 7 букв?',
    body: 'Уровень для гениев ждёт',
    cooldownDays: 5
  },

  // ===== Вечер (19:30-21:00) — этюд перед сном =====
  {
    id: 'evening-etude',
    slot: 'evening', weekdays: 'any',
    title: '🌃 Вечерний этюд',
    body: 'Собери все слова до сна',
    cooldownDays: 3
  },
  {
    id: 'evening-knowledge-word',
    slot: 'evening', weekdays: 'any',
    title: '💡 Знаешь слово «эфемерный»?',
    body: 'Загляни — внутри ещё интереснее',
    cooldownDays: 7
  },
  {
    id: 'evening-double-bonus',
    slot: 'evening', weekdays: 'any',
    title: '💎 Двойной бонус сегодня',
    body: 'До 23:59 — войди и забери',
    cooldownDays: 5
  },

  // ===== Ночь (22:30-23:00) — лёгкий уровень =====
  {
    id: 'night-easy-sleep',
    slot: 'night', weekdays: 'any',
    title: '🌙 Засыпательный уровень',
    body: 'Лёгкий — для сна, не для драмы',
    cooldownDays: 5
  },

  // ===== Cooldown / общие =====
  {
    id: 'cooldown-miss',
    slot: 'evening', weekdays: 'any',
    title: '📚 Слова без тебя пропадают',
    body: 'Возвращайся — новые буквы ждут',
    cooldownDays: 7
  },
  {
    id: 'streak-5-days',
    slot: 'evening', weekdays: 'any',
    title: '🔥 5 дней подряд! Молодец',
    body: 'Продолжай серию — 1 уровень и спать',
    cooldownDays: 10
  },
  {
    id: 'tip-rare-words',
    slot: 'lunch', weekdays: 'any',
    title: '🔤 Совет: как находить редкие слова',
    body: 'Гласная + согласная + гласная = выгодно',
    cooldownDays: 10
  }
];
