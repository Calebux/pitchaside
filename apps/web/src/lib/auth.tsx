'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { http, setToken, clearToken } from './http';
import type { IUser, IAuthResponse } from '@pitchaside/shared';

interface TwoFactorRequired {
  requires2FA: true;
  userId: string;
}

type LoginResult = { requires2FA: false } | TwoFactorRequired;

interface AuthContextValue {
  user: IUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  validate2FA: (userId: string, code: string) => Promise<void>;
  register: (data: {
    organizationName: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    country?: string;
    state?: string;
  }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
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

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    const res = await http.post<IAuthResponse | TwoFactorRequired>('/auth/login', { email, password });
    if ('requires2FA' in res && res.requires2FA) {
      return { requires2FA: true, userId: res.userId };
    }
    const authRes = res as IAuthResponse;
    setToken(authRes.accessToken);
    setUser(authRes.user);
    return { requires2FA: false };
  }, []);

  const validate2FA = useCallback(async (userId: string, code: string) => {
    const res = await http.post<IAuthResponse>('/auth/2fa/validate', { userId, code });
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
      country?: string;
      state?: string;
    }) => {
      const res = await http.post<IAuthResponse>('/auth/register', data);
      setToken(res.accessToken);
      setUser(res.user);
    },
    [],
  );

  const refreshUser = useCallback(async () => {
    try {
      const u = await http.get<IUser>('/auth/me');
      setUser(u);
    } catch {}
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    window.location.href = '/signin';
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, validate2FA, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
