/**
 * Утилиты для работы с localStorage
 */

const STORAGE_KEYS = {
  AUTH_TOKEN: 'authToken',
  USER_DATA: 'userData',
  TASKS: 'tasks_',
};

/**
 * Сохраняет данные в localStorage с обработкой ошибок
 * @param {string} key - ключ
 * @param {*} value - значение (будет сериализовано в JSON)
 * @returns {boolean} - успешность операции
 */
export function setItem(key, value) {
  try {
    const serialized = JSON.stringify(value);
    localStorage.setItem(key, serialized);
    return true;
  } catch (error) {
    console.error(`Error saving to localStorage (${key}):`, error);
    return false;
  }
}

/**
 * Получает данные из localStorage
 * @param {string} key - ключ
 * @param {*} defaultValue - значение по умолчанию
 * @returns {*} - десериализованное значение или defaultValue
 */
export function getItem(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(key);
    if (item === null || item === undefined) return defaultValue;

    try {
      return JSON.parse(item);
    } catch (parseError) {
      // Значение не валидный JSON — возвращаем сырой строковый item (например, токен)
      console.warn(`Could not parse localStorage item (${key}) as JSON. Returning raw string value.`);
      return item;
    }
  } catch (error) {
    console.error(`Error reading from localStorage (${key}):`, error);
    return defaultValue;
  }
}

/**
 * Удаляет элемент из localStorage
 * @param {string} key - ключ
 */
export function removeItem(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Error removing from localStorage (${key}):`, error);
  }
}

/**
 * Очищает все данные из localStorage
 */
export function clear() {
  try {
    localStorage.clear();
  } catch (error) {
    console.error('Error clearing localStorage:', error);
  }
}

/**
 * Сохраняет задачи пользователя
 * @param {string} username - имя пользователя
 * @param {Array} tasks - массив задач
 */
export function saveTasks(username, tasks) {
  return setItem(`${STORAGE_KEYS.TASKS}${username}`, tasks);
}

/**
 * Загружает задачи пользователя
 * @param {string} username - имя пользователя
 * @returns {Array} - массив задач
 */
export function loadTasks(username) {
  return getItem(`${STORAGE_KEYS.TASKS}${username}`, []);
}

export { STORAGE_KEYS };
