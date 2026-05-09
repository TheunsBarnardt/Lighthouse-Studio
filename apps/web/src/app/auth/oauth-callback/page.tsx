'use client';

import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';

import { useAuth } from '@/context/auth-context';
import { AuthApiError, authApi } from '@/lib/auth-client';

function OAuthCallbackPageInner() {
  const t = useTranslations('auth.oauthCallback');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const errorParam = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (errorParam) {
      setError(errorDescription ?? errorParam);
      return;
    }

    if (!code || !state) {
      setError('Missing code or state from provider. Please try signing in again.');
      return;
    }

    void (async () => {
      try {
        const result = await authApi.ssoCallback(code, state);
        await refresh();
        router.replace(result.returnTo || '/');
      } catch (e) {
        setError(e instanceof AuthApiError ? e.message : 'SSO sign-in failed. Please try again.');
      }
    })();
  }, [searchParams, router, refresh]);

  return (
    <div
      className="rounded-md border bg-card text-card-foreground p-4"
      style={{ maxWidth: 480, margin: '64px auto', padding: '32px' }}
    >
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>{t('title')}</h2>
      {error ? (
        <div
          role="alert"
          style={{
            borderRadius: 4,
            background: 'var(--bg-danger-subtle)',
            padding: '10px 12px',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      ) : (
        <p style={{ fontSize: 13 }} aria-live="polite">
          {t('title')}…
        </p>
      )}
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense>
      <OAuthCallbackPageInner />
    </Suspense>
  );
}
