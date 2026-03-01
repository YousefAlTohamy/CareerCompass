import { createContext, useContext, useState, useCallback } from 'react';
import { authAPI } from '../api/endpoints';
import apiClient from '../api/client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Error parsing stored user:', error);
      localStorage.removeItem('user');
      return null;
    }
  });

  /** Persist user (including role) to state + localStorage */
  const persistUser = useCallback((userData) => {
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  }, []);

  const login = async (email, password) => {
    try {
      const response = await authAPI.login({ email, password });
      const { user: userData, token } = response.data.data;
      localStorage.setItem('auth_token', token);
      persistUser(userData); // includes role
      return userData;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const register = async (data) => {
    try {
      const response = await authAPI.register(data);
      const { user: userData, token } = response.data.data;
      localStorage.setItem('auth_token', token);
      persistUser(userData); // includes role
      return userData;
    } catch (error) {
      console.error('Register error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    setUser(null);
  };

  /**
   * Refresh the stored user from GET /api/user.
   * Useful after profile updates or after role changes.
   */
  const refreshUser = useCallback(async () => {
    try {
      const response = await apiClient.get('/user');
      const freshUser = response.data;
      persistUser(freshUser);
      return freshUser;
    } catch (error) {
      console.error('refreshUser error:', error);
    }
  }, [persistUser]);

  return (
    <AuthContext.Provider value={{ user, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
