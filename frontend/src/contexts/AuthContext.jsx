import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  login as apiLogin,
  register as apiRegister,
  googleLogin as apiGoogleLogin,
  fetchMe,
  updateProfile as apiUpdateProfile,
  deleteAccount as apiDeleteAccount,
  setToken,
  getToken,
} from '../api/authApi';
import { teardownPushNotifications } from '../hooks/useNotifications';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    fetchMe()
      .then((data) => setUser(data.user))
      .catch(() => {
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (credentials) => {
    const data = await apiLogin(credentials);
    setToken(data.token);
    setUser(data.user);
    return data;
  }, []);

  const register = useCallback(async (credentials) => {
    const data = await apiRegister(credentials);
    setToken(data.token);
    setUser(data.user);
    return data;
  }, []);

  const loginWithGoogle = useCallback(async (credential) => {
    const data = await apiGoogleLogin(credential);
    setToken(data.token);
    setUser(data.user);
    return data;
  }, []);

  const updateUser = useCallback(async (updates) => {
    const data = await apiUpdateProfile(updates);
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(async () => {
    await teardownPushNotifications();
    setToken(null);
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  const deleteAccount = useCallback(async () => {
    await apiDeleteAccount();
    await teardownPushNotifications();
    setToken(null);
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginWithGoogle, updateUser, logout, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
