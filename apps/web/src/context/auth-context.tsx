'use client';

import type { ReactNode } from 'react';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import type { MeResponse } from '@/lib/auth-client';

import { authApi } from '@/lib/auth-client';

interface AuthContextValue {
  user: MeResponse | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await authApi.getMe();
      setUser(me);
    } catch {
      setUser(null);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authApi.signOut();
    } finally {
      setUser(null);
      window.location.href = '/auth/sign-in';
    }
  }, []);

  useEffect(() => {
    void refresh().finally(() => {
      setIsLoading(false);
    });
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ user, isLoading, refresh, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
