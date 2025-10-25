import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import api from '../services/api.js';
import { AUTH_STORAGE_KEY } from '../utils/storageKeys.js';

const AuthContext = createContext(null);

function setAxiosAuthorization(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

function readStoredSession() {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = readStoredSession();
    if (stored?.token && stored?.user) {
      setAxiosAuthorization(stored.token);
      setUser(stored.user);
      setToken(stored.token);
    } else {
      setAxiosAuthorization(null);
    }
    setLoading(false);
  }, []);

  const persistSession = useCallback((session) => {
    setUser(session.user);
    setToken(session.token);
    setAxiosAuthorization(session.token);
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  }, []);

  const clearSession = useCallback(() => {
    setUser(null);
    setToken(null);
    setAxiosAuthorization(null);
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  }, []);

  const updateStoredUser = useCallback((updatedUser) => {
    setUser(updatedUser);
    setToken((currentToken) => {
      if (currentToken) {
        setAxiosAuthorization(currentToken);
      }
      return currentToken;
    });

    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
      if (raw) {
        try {
          const session = JSON.parse(raw);
          session.user = updatedUser;
          window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
        } catch (error) {
          window.localStorage.removeItem(AUTH_STORAGE_KEY);
        }
      }
    }
  }, []);

  const login = useCallback(async ({ email, password }) => {
    const response = await api.post('/auth/login', { email, password });
    persistSession(response.data);
    return response.data.user;
  }, [persistSession]);

  const register = useCallback(async ({ name, email, password }) => {
    const response = await api.post('/auth/register', { name, email, password });
    persistSession(response.data);
    return response.data.user;
  }, [persistSession]);

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  const fetchProfile = useCallback(async () => {
    const response = await api.get('/auth/me');
    updateStoredUser(response.data);
    return response.data;
  }, [updateStoredUser]);

  const updateProfile = useCallback(async (payload) => {
    const response = await api.put('/auth/me', payload);
    updateStoredUser(response.data);
    return response.data;
  }, [updateStoredUser]);

  const changePassword = useCallback(async ({ currentPassword, newPassword }) => {
    const response = await api.put('/auth/me/password', { currentPassword, newPassword });
    return response.data;
  }, []);

  const requestPasswordReset = useCallback(async ({ email }) => {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  }, []);

  const resetPassword = useCallback(async ({ token: resetToken, password }) => {
    const response = await api.post('/auth/reset-password', { token: resetToken, password });
    return response.data;
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      logout,
      register,
      fetchProfile,
      updateProfile,
      changePassword,
      requestPasswordReset,
      resetPassword,
      isAdmin: user?.role === 'ADMIN',
    }),
    [
      user,
      token,
      loading,
      login,
      logout,
      register,
      fetchProfile,
      updateProfile,
      changePassword,
      requestPasswordReset,
      resetPassword,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
