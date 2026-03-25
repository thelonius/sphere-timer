import { useState } from 'react';
import { AuthContext } from './authContext';
import { setItem, getItem, removeItem, STORAGE_KEYS } from '../utils/storageUtils';
import { authAPI } from '../services/api';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const token = getItem(STORAGE_KEYS.AUTH_TOKEN);
    let userData = getItem(STORAGE_KEYS.USER_DATA);

    // If there's no token or userData — no authenticated user
    if (!token || !userData) return null;

    // If userData is a string (from bad serialization), try to parse it
    if (typeof userData === 'string') {
      try {
        userData = JSON.parse(userData);
      } catch (parseError) {
        console.warn('Invalid userData found in localStorage — clearing auth keys.');
        removeItem(STORAGE_KEYS.AUTH_TOKEN);
        removeItem(STORAGE_KEYS.USER_DATA);
        return null;
      }
    }

    // Ensure we have an object
    if (typeof userData === 'object' && userData !== null) return userData;

    // Fallback: clear bad data
    removeItem(STORAGE_KEYS.AUTH_TOKEN);
    removeItem(STORAGE_KEYS.USER_DATA);
    return null;
  });
  const [loading] = useState(false);

  const register = async (username, email, password) => {
    try {
      const data = await authAPI.register(username, email, password);
      const { user: userData, token, refreshToken } = data.data;
      
      setItem(STORAGE_KEYS.AUTH_TOKEN, token);
      setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
      setItem(STORAGE_KEYS.USER_DATA, userData);
      setUser(userData);
      
      return { success: true, user: userData };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const login = async (email, password) => {
    try {
      const data = await authAPI.login(email, password);
      const { user: userData, token, refreshToken } = data.data;
      
      setItem(STORAGE_KEYS.AUTH_TOKEN, token);
      setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
      setItem(STORAGE_KEYS.USER_DATA, userData);
      setUser(userData);
      
      return { success: true, user: userData };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
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
