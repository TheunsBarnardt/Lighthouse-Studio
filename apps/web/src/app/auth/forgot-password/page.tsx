'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { authApi } from '@/lib/auth-client';

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

const ForgotPasswordSchema = z.object({
  email: z.string().email('Enter a valid email address'),
});

export default function ForgotPasswordPage() {
  const t = useTranslations('auth.forgotPassword');
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');
  const [captchaToken] = useState<string>('');

  const form = useForm({
    resolver: zodResolver(ForgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const { formState } = form;

  async function onSubmit(values: { email: string }) {
    await authApi.forgotPassword(values.email, captchaToken || undefined);
    setSentEmail(values.email);
    setSent(true);
  }

  if (sent) {
    return (
      <div style={cardStyle}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--fg-primary)', marginBottom: 12 }}>
          {t('successTitle')}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--fg-secondary)', marginBottom: 20 }}>
          {t('successMessage', { email: sentEmail })}
        </p>
        <p style={{ textAlign: 'center', fontSize: 13 }}>
          <Link
            href="/auth/sign-in"
            style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}
          >
            {t('backToSignIn')}
          </Link>
        </p>
      </div>
    );
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
          <label htmlFor="email" style={labelStyle}>
            {t('emailLabel')}
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={t('emailPlaceholder')}
            aria-required
            style={inputStyle}
            {...form.register('email')}
          />
          {formState.errors.email && (
            <p style={{ fontSize: 12, color: 'var(--fg-danger, #dc2626)', marginTop: 3 }}>
              {formState.errors.email.message}
            </p>
          )}
        </div>

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
          {t('backToSignIn')}
        </Link>
      </p>
    </div>
  );
}
