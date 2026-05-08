'use client';

import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {t('title')}…
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense>
      <OAuthCallbackPageInner />
    </Suspense>
  );
}
