'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/context/auth-context';

export default function SamlCallbackPage() {
  const t = useTranslations('auth.samlCallback');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      setError(t('error', { message: errorParam }));
      return;
    }

    // TODO: SAML assertions are POSTed to this page; handle via a server route that sets the session
    void (async () => {
      try {
        await refresh();
        void router.replace('/');
      } catch {
        setError(t('error', { message: 'Failed to sign in.' }));
      }
    })();
  }, [searchParams, router, refresh, t]);

  return (
    <Card>
      <CardHeader><CardTitle>{t('title')}</CardTitle></CardHeader>
      <CardContent>
        {error
          ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
          : <p className="text-sm text-muted-foreground" aria-live="polite">{t('title')}</p>
        }
      </CardContent>
    </Card>
  );
}
