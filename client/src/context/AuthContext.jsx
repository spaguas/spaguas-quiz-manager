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
    window.localStorage.removeItem(STORAGE_KEY);
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

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      logout,
      register,
      isAdmin: user?.role === 'ADMIN',
    }),
    [user, token, loading, login, logout, register],
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
