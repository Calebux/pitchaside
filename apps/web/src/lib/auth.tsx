'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { http, setToken, clearToken } from './http';
import type { IUser, IAuthResponse } from '@pitchaside/shared';

interface AuthContextValue {
  user: IUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    organizationName: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<IUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('pitchaside_token') : null;
    if (!token) {
      setLoading(false);
      return;
    }
    http
      .get<IUser>('/auth/me')
      .then(setUser)
      .catch(() => {
        clearToken();
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await http.post<IAuthResponse>('/auth/login', { email, password });
    setToken(res.accessToken);
    setUser(res.user);
  }, []);

  const register = useCallback(
    async (data: {
      organizationName: string;
      firstName: string;
      lastName: string;
      email: string;
      password: string;
    }) => {
      const res = await http.post<IAuthResponse>('/auth/register', data);
      setToken(res.accessToken);
      setUser(res.user);
    },
    [],
  );

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    window.location.href = '/signin';
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
