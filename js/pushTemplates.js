// pushTemplates.js — шаблоны push-уведомлений для «Слова из букв».
//
// Тон: бодрый, образовательный, лёгкая игривость.
// Аудитория: любители тренировки мозга, scrabble-фаны.
//
// Каждый шаблон: { id, slot, weekdays, title, body, cooldownDays, tail?, requires?, weight? }
// Слоты — утро и вечер (расписание — в pushScheduler.js). `tail: true` —
// неизменная фраза последнего в очереди: его мост повторяет раз в сутки, пока
// человек не зайдёт, поэтому в ней нет дня, даты и обещаний.
//
// Тексты не обещают того, чего в игре нет: ни бонусов по дням, ни серий заходов
// в ней нет — значит, нет их и в напоминаниях.
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
    id: 'cooldown-miss',
    slot: 'evening', weekdays: 'any',
    title: '📚 Слова без тебя пропадают',
    body: 'Возвращайся — новые буквы ждут',
    cooldownDays: 7,
    tail: true
  }
];
