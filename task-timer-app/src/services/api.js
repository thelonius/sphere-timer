// Конфигурация API
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
console.log('Current API URL:', API_URL);

import { getItem, setItem, removeItem, STORAGE_KEYS } from '../utils/storageUtils';

// Получение токена из localStorage
const getAuthToken = () => {
  return getItem(STORAGE_KEYS.AUTH_TOKEN);
};

// Базовый fetch с обработкой ошибок
const fetchWithAuth = async (endpoint, options = {}) => {
  const token = getAuthToken();
  
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    },
  };

  try {
    const response = await fetch(`${API_URL}${endpoint}`, config);
    
    // Если токен истек или невалиден (и это не попытка входа)
    if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/register') && !endpoint.includes('/auth/refresh')) {
      const refreshTokenValue = getItem(STORAGE_KEYS.REFRESH_TOKEN);
      if (refreshTokenValue) {
        try {
          const res = await fetch(`${API_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: refreshTokenValue })
          });
          if (res.ok) {
            const refreshData = await res.json();
            if (refreshData.success) {
              setItem(STORAGE_KEYS.AUTH_TOKEN, refreshData.data.token);
              setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshData.data.refreshToken);
              // Retry the original request
              config.headers['Authorization'] = `Bearer ${refreshData.data.token}`;
              const retryRes = await fetch(`${API_URL}${endpoint}`, config);
              if (retryRes.ok) {
                return await retryRes.json();
              }
            }
          }
        } catch (err) {
          console.error('Failed to refresh token', err);
        }
      }
      
      removeItem(STORAGE_KEYS.AUTH_TOKEN);
      removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      removeItem(STORAGE_KEYS.USER_DATA);
      window.location.reload();
      return;
    }

    let data;
    try {
      data = await response.json();
    } catch (e) {
      data = {};
    }
    
    if (!response.ok) {
      const errorMsg = data.message || data.detail || `Error ${response.status}: ${response.statusText}`;
      throw new Error(errorMsg);
    }
    
    return data;
  } catch (error) {
    console.error('API Error:', error);
    if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
      throw new Error('Could not connect to server. Check your network or firewall.');
    }
    throw error;
  }
};

// API методы для аутентификации
export const authAPI = {
  // Регистрация
  register: async (username, email, password) => {
    return fetchWithAuth('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });
  },

  // Вход
  login: async (email, password) => {
    return fetchWithAuth('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  // Сброс пароля (забытый пароль)
  resetPassword: async (email, newPassword) => {
    return fetchWithAuth('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, new_password: newPassword }),
    });
  },

  // Выход
  logout: async () => {
    const refreshToken = getItem(STORAGE_KEYS.REFRESH_TOKEN);
    const bodyObj = refreshToken ? { refreshToken } : {};
    return fetchWithAuth('/auth/logout', {
      method: 'POST',
      body: JSON.stringify(bodyObj),
    });
  },

  // Проверка токена
  verifyToken: async () => {
    return fetchWithAuth('/auth/verify', {
      method: 'GET',
    });
  },

  // Обновление токена
  refreshToken: async (refreshToken) => {
    return fetchWithAuth('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  },
};

// API методы для задач
export const tasksAPI = {
  // Получить все задачи пользователя
  getTasks: async () => {
    return fetchWithAuth('/tasks', {
      method: 'GET',
    });
  },

  // Создать задачу
  createTask: async (taskData) => {
    return fetchWithAuth('/tasks', {
      method: 'POST',
      body: JSON.stringify(taskData),
    });
  },

  // Обновить задачу
  updateTask: async (taskId, taskData) => {
    return fetchWithAuth(`/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify(taskData),
    });
  },

  // Удалить задачу
  deleteTask: async (taskId) => {
    return fetchWithAuth(`/tasks/${taskId}`, {
      method: 'DELETE',
    });
  },

  // Начать таймер
  startTimer: async (taskId) => {
    return fetchWithAuth(`/tasks/${taskId}/start`, {
      method: 'POST',
    });
  },

  // Остановить таймер
  stopTimer: async (taskId) => {
    return fetchWithAuth(`/tasks/${taskId}/stop`, {
      method: 'POST',
    });
  },

  // Получить статистику
  getStats: async (startDate, endDate) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    return fetchWithAuth(`/tasks/stats?${params.toString()}`, {
      method: 'GET',
    });
  },
};

// API методы для пользователя
export const userAPI = {
  // Получить профиль
  getProfile: async () => {
    return fetchWithAuth('/user/profile', {
      method: 'GET',
    });
  },

  // Обновить профиль
  updateProfile: async (userData) => {
    return fetchWithAuth('/user/profile', {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  },

  // Изменить пароль
  changePassword: async (currentPassword, newPassword) => {
    return fetchWithAuth('/user/password', {
      method: 'PUT',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
  },
};

export default {
  auth: authAPI,
  tasks: tasksAPI,
  user: userAPI,
};
