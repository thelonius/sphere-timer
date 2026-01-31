// Конфигурация API
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Получение токена из localStorage
const getAuthToken = () => {
  return localStorage.getItem('authToken');
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
    
    // Если токен истек или невалиден
    if (response.status === 401) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('userData');
      window.location.reload();
      return;
    }

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Ошибка запроса');
    }
    
    return data;
  } catch (error) {
    console.error('API Error:', error);
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

  // Выход
  logout: async () => {
    return fetchWithAuth('/auth/logout', {
      method: 'POST',
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
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },
};

export default {
  auth: authAPI,
  tasks: tasksAPI,
  user: userAPI,
};
