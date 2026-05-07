'use client';

import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/context/auth-context';

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

    if (errorParam) {
      setError(t('error', { message: errorParam }));
      return;
    }

    if (!code) {
      setError(t('error', { message: 'No code received from provider.' }));
      return;
    }

    // TODO: POST to /api/v1/auth/oauth/callback with code + state
    void (async () => {
      try {
        await refresh();
        router.replace(state ?? '/');
      } catch {
        setError(t('error', { message: 'Failed to sign in.' }));
      }
    })();
  }, [searchParams, router, refresh, t]);

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
            {t('title')}
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
