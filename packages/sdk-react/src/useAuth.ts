import type { AuthClient, Session, AuthStateEvent } from '@platform/sdk';

import { useState, useEffect, useCallback } from 'react';

import { usePlatformClient } from './context.js';

export interface AuthState {
  session: Session | null;
  isLoading: boolean;
}

export interface AuthActions {
  signIn: AuthClient['signIn'];
  signOut: AuthClient['signOut'];
  signUp: AuthClient['signUp'];
  signInWithProvider: AuthClient['signInWithProvider'];
  signInWithMagicLink: AuthClient['signInWithMagicLink'];
  refreshSession: AuthClient['refreshSession'];
}

export function useAuth(): AuthState & AuthActions {
  const client = usePlatformClient();
  const [session, setSession] = useState<Session | null>(() => client.auth.getSession());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const unsub = client.auth.onAuthStateChange((_event: AuthStateEvent, s: Session | null) => {
      setSession(s);
      setIsLoading(false);
    });
    // Sync on mount in case session changed between render and effect
    setSession(client.auth.getSession());
    return unsub;
  }, [client]);

  const signIn = useCallback<AuthClient['signIn']>(
    async (input) => {
      setIsLoading(true);
      try {
        return await client.auth.signIn(input);
      } finally {
        setIsLoading(false);
      }
    },
    [client],
  );

  const signOut = useCallback<AuthClient['signOut']>(
    async (opts) => {
      setIsLoading(true);
      try {
        await client.auth.signOut(opts);
        return;
      } finally {
        setIsLoading(false);
      }
    },
    [client],
  );

  const signUp = useCallback<AuthClient['signUp']>((input) => client.auth.signUp(input), [client]);

  const signInWithProvider = useCallback<AuthClient['signInWithProvider']>(
    (provider, opts) => {
      client.auth.signInWithProvider(provider, opts);
    },
    [client],
  );

  const signInWithMagicLink = useCallback<AuthClient['signInWithMagicLink']>(
    (input) => client.auth.signInWithMagicLink(input),
    [client],
  );

  const refreshSession = useCallback<AuthClient['refreshSession']>(
    () => client.auth.refreshSession(),
    [client],
  );

  return {
    session,
    isLoading,
    signIn,
    signOut,
    signUp,
    signInWithProvider,
    signInWithMagicLink,
    refreshSession,
  };
}
