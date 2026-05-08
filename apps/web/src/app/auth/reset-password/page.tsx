'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

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
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--fg-primary)',
  marginBottom: 4,
};

const cardStyle: React.CSSProperties = {
  padding: 32,
  borderRadius: 8,
  border: '1px solid var(--border-default)',
  background: 'var(--bg-surface)',
};

const ResetPasswordSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm: z.string().min(1, 'Confirm your password'),
  })
  .refine((v) => v.password === v.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });

function ResetPasswordPageInner() {
  const t = useTranslations('auth.resetPassword');
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    resolver: zodResolver(ResetPasswordSchema),
    defaultValues: { password: '', confirm: '' },
  });

  const { formState } = form;

  async function onSubmit(values: { password: string }) {
    setError(null);
    try {
      await authApi.resetPassword(token, values.password);
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof AuthApiError && err.statusCode === 404
          ? t('invalidToken')
          : 'Failed to reset password.',
      );
    }
  }

  if (!token) {
    return (
      <div style={cardStyle}>
        <div
          style={{
            padding: '8px 12px',
            borderRadius: 4,
            border: '1px solid var(--fg-danger, #dc2626)',
            background: 'oklch(0.97 0.02 25)',
            fontSize: 13,
            color: 'var(--fg-danger, #dc2626)',
          }}
        >
          {t('invalidToken')}
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div style={cardStyle}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--fg-primary)', marginBottom: 12 }}>
          {t('successTitle')}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--fg-secondary)', marginBottom: 20 }}>
          {t('successMessage')}
        </p>
        <p style={{ textAlign: 'center', fontSize: 13 }}>
          <Link
            href="/auth/sign-in"
            style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}
          >
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--fg-primary)', marginBottom: 20 }}>
        {t('title')}
      </h1>

      <form
        onSubmit={(e) => {
          void form.handleSubmit(onSubmit)(e);
        }}
        noValidate
      >
        <div style={{ marginBottom: 14 }}>
          <label htmlFor="password" style={labelStyle}>
            {t('passwordLabel')}
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder={t('passwordPlaceholder')}
            style={inputStyle}
            {...form.register('password')}
          />
          {formState.errors.password && (
            <p style={{ fontSize: 12, color: 'var(--fg-danger, #dc2626)', marginTop: 3 }}>
              {formState.errors.password.message}
            </p>
          )}
        </div>

        <div style={{ marginBottom: 14 }}>
          <label htmlFor="confirm" style={labelStyle}>
            {t('confirmLabel')}
          </label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            placeholder={t('confirmPlaceholder')}
            style={inputStyle}
            {...form.register('confirm')}
          />
          {formState.errors.confirm && (
            <p style={{ fontSize: 12, color: 'var(--fg-danger, #dc2626)', marginTop: 3 }}>
              {formState.errors.confirm.message}
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
          style={{ width: '100%' }}
          disabled={formState.isSubmitting}
        >
          {formState.isSubmitting ? t('submitting') : t('submit')}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordPageInner />
    </Suspense>
  );
}
