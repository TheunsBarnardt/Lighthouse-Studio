'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';

import { authApi } from '@/lib/auth-client';

const cardStyle: React.CSSProperties = {
  padding: 32,
  borderRadius: 8,
  border: '1px solid var(--border-default)',
  background: 'var(--bg-surface)',
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
      <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--fg-primary)', marginBottom: 12 }}>
        {title}
      </h1>

      {status === 'verifying' && (
        <p style={{ fontSize: 13, color: 'var(--fg-secondary)' }} aria-live="polite">
          Verifying…
        </p>
      )}

      {status === 'success' && (
        <>
          <p
            style={{ fontSize: 13, color: 'var(--fg-secondary)', marginBottom: 20 }}
            aria-live="polite"
          >
            {t('successMessage')}
          </p>
          <p style={{ textAlign: 'center' }}>
            <Link href="/auth/sign-in">
              <button className="pg-btn pg-btn-primary">{t('signIn')}</button>
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
