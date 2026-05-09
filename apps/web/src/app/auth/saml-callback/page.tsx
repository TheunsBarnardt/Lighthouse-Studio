'use client';

import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';

import { useAuth } from '@/context/auth-context';

function SamlCallbackPageInner() {
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
        router.replace('/');
      } catch {
        setError(t('error', { message: 'Failed to sign in.' }));
      }
    })();
  }, [searchParams, router, refresh, t]);

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
          {t('title')}
        </p>
      )}
    </div>
  );
}

export default function SamlCallbackPage() {
  return (
    <Suspense>
      <SamlCallbackPageInner />
    </Suspense>
  );
}
