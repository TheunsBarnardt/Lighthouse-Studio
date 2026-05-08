'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useAuth } from '@/context/auth-context';
import { AuthApiError, authApi } from '@/lib/auth-client';

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 36,
  padding: '0 12px',
  borderRadius: 4,
  border: '1px solid var(--border-default)',
  background: 'var(--bg-canvas)',
  color: 'var(--fg-primary)',
  fontSize: 13,
  boxSizing: 'border-box',
  letterSpacing: '0.1em',
};

const cardStyle: React.CSSProperties = {
  padding: 32,
  borderRadius: 8,
  border: '1px solid var(--border-default)',
  background: 'var(--bg-surface)',
};

const MfaSchema = z.object({
  code: z.string().min(6).max(10),
});

function MfaChallengePageInner() {
  const t = useTranslations('auth.mfaChallenge');
  const router = useRouter();
  const searchParams = useSearchParams();
  const challengeId = searchParams.get('challengeId') ?? '';
  const returnTo = searchParams.get('returnTo') ?? '/';
  const { refresh } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const form = useForm({ resolver: zodResolver(MfaSchema), defaultValues: { code: '' } });
  const { formState } = form;

  async function onSubmit(values: { code: string }) {
    setError(null);
    try {
      await authApi.mfaChallenge(challengeId, values.code);
      await refresh();
      router.replace(returnTo);
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : t('error', { attemptsLeft: '?' }));
    }
  }

  return (
    <div style={cardStyle}>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--fg-primary)', marginBottom: 4 }}>
        {t('title')}
      </h1>
      <p style={{ fontSize: 13, color: 'var(--fg-secondary)', marginBottom: 20 }}>
        {t('subtitle')}
      </p>

      <form
        onSubmit={(e) => {
          void form.handleSubmit(onSubmit)(e);
        }}
        noValidate
      >
        <div style={{ marginBottom: 14 }}>
          <label
            htmlFor="code"
            style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--fg-primary)',
              marginBottom: 4,
            }}
          >
            {t('codeLabel')}
          </label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder={t('codePlaceholder')}
            maxLength={10}
            aria-required
            style={inputStyle}
            {...form.register('code')}
          />
          {formState.errors.code && (
            <p style={{ fontSize: 12, color: 'var(--fg-danger, #dc2626)', marginTop: 3 }}>
              {String(formState.errors.code.message)}
            </p>
          )}
        </div>

        {error && (
          <div
            style={{
              marginBottom: 12,
              padding: '8px 12px',
              borderRadius: 4,
              border: '1px solid var(--fg-danger, #dc2626)',
              background: 'oklch(0.97 0.02 25)',
              fontSize: 13,
              color: 'var(--fg-danger, #dc2626)',
            }}
            aria-live="polite"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          className="pg-btn pg-btn-primary"
          style={{ width: '100%', marginBottom: 16 }}
          disabled={formState.isSubmitting}
        >
          {formState.isSubmitting ? t('submitting') : t('submit')}
        </button>
      </form>

      <p style={{ textAlign: 'center', fontSize: 13 }}>
        <Link href="/auth/sign-in" style={{ color: 'var(--fg-secondary)', textDecoration: 'none' }}>
          {t('lostDevice')}
        </Link>
      </p>
    </div>
  );
}

export default function MfaChallengePage() {
  return (
    <Suspense>
      <MfaChallengePageInner />
    </Suspense>
  );
}
