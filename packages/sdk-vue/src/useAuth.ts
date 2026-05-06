import type { AuthClient, Session } from '@platform/sdk';

import { ref, onMounted, onUnmounted, type Ref } from 'vue';

import { injectPlatformClient } from './inject.js';

export interface AuthComposable {
  session: Ref<Session | null>;
  isLoading: Ref<boolean>;
  signIn: AuthClient['signIn'];
  signOut: AuthClient['signOut'];
  signUp: AuthClient['signUp'];
  signInWithProvider: AuthClient['signInWithProvider'];
  signInWithMagicLink: AuthClient['signInWithMagicLink'];
}

export function useAuth(): AuthComposable {
  const client = injectPlatformClient();
  const session = ref<Session | null>(client.auth.getSession());
  const isLoading = ref(false);
  let unsub: (() => void) | null = null;

  onMounted(() => {
    unsub = client.auth.onAuthStateChange((_event, s) => {
      session.value = s;
      isLoading.value = false;
    });
    session.value = client.auth.getSession();
  });

  onUnmounted(() => {
    unsub?.();
  });

  async function signIn(input: Parameters<AuthClient['signIn']>[0]) {
    isLoading.value = true;
    try {
      return await client.auth.signIn(input);
    } finally {
      isLoading.value = false;
    }
  }

  async function signOut(opts?: Parameters<AuthClient['signOut']>[0]) {
    isLoading.value = true;
    try {
      await client.auth.signOut(opts);
      return;
    } finally {
      isLoading.value = false;
    }
  }

  return {
    session,
    isLoading,
    signIn,
    signOut,
    signUp: (input) => client.auth.signUp(input),
    signInWithProvider: (provider, opts) => {
      client.auth.signInWithProvider(provider, opts);
    },
    signInWithMagicLink: (input) => client.auth.signInWithMagicLink(input),
  };
}
