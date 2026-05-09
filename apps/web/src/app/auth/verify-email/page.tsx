'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';

import { Button } from '@/components/ui/button';
import { authApi } from '@/lib/auth-client';

const cardStyle: React.CSSProperties = {
  padding: 32,
  borderRadius: 8,
  border: '1px solid var(--border-default)',
};

function VerifyEmailPageInner() {
  const t = useTranslations('auth.verifyEmail');
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      return;
    }
    void authApi
      .verifyEmail(token)
      .then(() => {
        setStatus('success');
        return undefined;
      })
      .catch(() => {
        setStatus('error');
      });
  }, [token]);

  const title =
    status === 'verifying'
      ? t('title')
      : status === 'success'
        ? t('successTitle')
        : 'Verification failed';

  return (
    <div style={cardStyle}>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>{title}</h1>

      {status === 'verifying' && (
        <p style={{ fontSize: 13 }} aria-live="polite">
          Verifying…
        </p>
      )}

      {status === 'success' && (
        <>
          <p style={{ fontSize: 13, marginBottom: 20 }} aria-live="polite">
            {t('successMessage')}
          </p>
          <p style={{ textAlign: 'center' }}>
            <Link href="/auth/sign-in">
              <Button type="button">{t('signIn')}</Button>
            </Link>
          </p>
        </>
      )}

      {status === 'error' && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: 4,
            border: '1px solid var(--fg-danger, #dc2626)',
            background: 'oklch(0.97 0.02 25)',
            fontSize: 13,
            color: 'var(--fg-danger, #dc2626)',
          }}
          aria-live="polite"
        >
          {t('invalidToken')}
        </div>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailPageInner />
    </Suspense>
  );
}
