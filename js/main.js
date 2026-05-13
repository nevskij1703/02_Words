// main.js — bootstrap. На этом этапе только убирает экран загрузки.
// Полная инициализация будет добавлена на следующих этапах.

document.addEventListener('DOMContentLoaded', () => {
  const loading = document.getElementById('loading');
  if (loading) loading.textContent = 'Скоро тут будет игра…';
});
