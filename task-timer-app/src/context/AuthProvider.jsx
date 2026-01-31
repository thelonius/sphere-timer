import { useState } from 'react';
import { AuthContext } from './authContext';
import { setItem, getItem, removeItem, STORAGE_KEYS } from '../utils/storageUtils';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const token = getItem(STORAGE_KEYS.AUTH_TOKEN);
    const userData = getItem(STORAGE_KEYS.USER_DATA);
    return (token && userData) ? userData : null;
  });
  const [loading] = useState(false);

  const register = async (username, email, password) => {
    try {
      // Готово для подключения к API
      // import { authAPI } from '../services/api';
      // const data = await authAPI.register(username, email, password);
      // const { user: userData, token } = data;
      
      // Временная реализация (без бэкенда)
      const userData = {
        id: Date.now(),
        username,
        email,
        createdAt: new Date().toISOString()
      };
      const token = 'temp_token_' + Date.now();
      
      setItem(STORAGE_KEYS.AUTH_TOKEN, token);
      setItem(STORAGE_KEYS.USER_DATA, userData);
      setUser(userData);
      
      return { success: true, user: userData };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const login = async (email, password) => {
    try {
      // Готово для подключения к API
      // import { authAPI } from '../services/api';
      // const data = await authAPI.login(email, password);
      // const { user: userData, token } = data;
      
      // Тестовый аккаунт
      if (email === 'test@gmail.com' && password === '123456') {
        const userData = {
          id: 1,
          username: 'TestTestTestTestTest',
          email: 'test@gmail.com',
          loginDate: new Date().toISOString()
        };
        const token = 'test_token_' + Date.now();
        
        setItem(STORAGE_KEYS.AUTH_TOKEN, token);
        setItem(STORAGE_KEYS.USER_DATA, userData);
        setUser(userData);
        
        return { success: true, user: userData };
      }
      
      // Временная реализация (без бэкенда)
      const userData = {
        id: Date.now(),
        username: email.split('@')[0],
        email,
        loginDate: new Date().toISOString()
      };
      const token = 'temp_token_' + Date.now();
      
      setItem(STORAGE_KEYS.AUTH_TOKEN, token);
      setItem(STORAGE_KEYS.USER_DATA, userData);
      setUser(userData);
      
      return { success: true, user: userData };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = () => {
    removeItem(STORAGE_KEYS.AUTH_TOKEN);
    removeItem(STORAGE_KEYS.USER_DATA);
    removeItem('sphereTimerTasks');
    setUser(null);
  };

  const value = {
    user,
    loading,
    register,
    login,
    logout,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
