/**
 * Форматирует миллисекунды в читаемый формат времени
 * @param {number} milliseconds - время в миллисекундах
 * @returns {string} - отформатированное время (H:MM:SS или M:SS)
 */
export function formatTime(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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
 * Получает текущую дату в формате YYYY-MM-DD
 * @returns {string} - дата в формате YYYY-MM-DD
 */
export function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}
