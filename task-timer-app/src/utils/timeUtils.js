/**
 * Форматирует миллисекунды в читаемый формат времени
 * @param {number} milliseconds - время в миллисекундах
 * @returns {string} - отформатированное время (H:MM:SS или M:SS)
 */
export function formatTime(milliseconds) {
  const totalSeconds = Math.floor(Math.max(0, milliseconds) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Форматирует миллисекунды в компактный формат (Xч Yм)
 * @param {number} milliseconds - время в миллисекундах
 * @returns {string} - отформатированное время
 */
export function formatTimeCompact(milliseconds, translations = { hours: 'ч', minutes: 'м' }) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}${translations.hours} ${minutes}${translations.minutes}`;
  }
  return `${minutes}${translations.minutes}`;
}

/**
 * Форматирует дату или таймштамп в локальный формат YYYY-MM-DD
 * @param {Date|number} date - дата или таймштамп
 * @returns {string} - дата в формате YYYY-MM-DD
 */
export function formatDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Получает текущую дату в локальном часовом поясе в формате YYYY-MM-DD
 * @returns {string} - дата в формате YYYY-MM-DD
 */
export function getTodayDate() {
  return formatDate(new Date());
}
