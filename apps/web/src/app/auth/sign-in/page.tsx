'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { SsoButtons } from '@/components/ui/sso-buttons';
import { useAuth } from '@/context/auth-context';
import { AuthApiError, authApi } from '@/lib/auth-client';

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 36,
  padding: '0 12px',
  borderRadius: 4,
  border: '1px solid var(--border-default)',
  fontSize: 13,
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  marginBottom: 4,
};

const fieldStyle: React.CSSProperties = { marginBottom: 14 };

const errorStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--fg-danger, #dc2626)',
  marginTop: 3,
};

const SignInSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  remember: z.boolean().optional(),
});

type SignInValues = z.infer<typeof SignInSchema>;

function SignInPageInner() {
  const t = useTranslations('auth.signIn');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const returnTo = searchParams.get('returnTo') ?? '/';

  const form = useForm<SignInValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- zod 3.25 / hookform 3.10 type incompatibility
    resolver: zodResolver(SignInSchema as any),
    defaultValues: { email: '', password: '', remember: false },
  });

  const { formState } = form;

  async function onSubmit(values: SignInValues) {
    setError(null);
    try {
      const result = await authApi.signIn({
        email: values.email,
        password: values.password,
        ...(values.remember !== undefined && { remember: values.remember }),
      });

      if ('challengeId' in result) {
        const params = new URLSearchParams({ challengeId: result.challengeId, returnTo });
        router.replace(`/auth/mfa-challenge?${params.toString()}`);
        return;
      }

      await refresh();
      router.replace(returnTo);
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : t('error'));
    }
  }

  return (
    <div
      style={{
        padding: 32,
        borderRadius: 8,
        border: '1px solid var(--border-default)',
      }}
    >
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{t('title')}</h1>
      <p style={{ fontSize: 13, marginBottom: 20 }}>{t('subtitle')}</p>

      <form
        onSubmit={(e) => {
          void form.handleSubmit(onSubmit)(e);
        }}
        noValidate
      >
        <div style={fieldStyle}>
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
          {formState.errors.email && <p style={errorStyle}>{formState.errors.email.message}</p>}
        </div>

        <div style={fieldStyle}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 4,
            }}
          >
            <label htmlFor="password" style={{ ...labelStyle, marginBottom: 0 }}>
              {t('passwordLabel')}
            </label>
            <Link href="/auth/forgot-password" style={{ fontSize: 12, textDecoration: 'none' }}>
              {t('forgotPassword')}
            </Link>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder={t('passwordPlaceholder')}
            aria-required
            style={inputStyle}
            {...form.register('password')}
          />
          {formState.errors.password && (
            <p style={errorStyle}>{formState.errors.password.message}</p>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <input
            id="remember"
            type="checkbox"
            style={{ width: 14, height: 14, cursor: 'pointer' }}
            {...form.register('remember')}
          />
          <label htmlFor="remember" style={{ fontSize: 13, cursor: 'pointer' }}>
            {t('rememberMe')}
          </label>
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

        <Button
          type="submit"
          style={{ width: '100%' }}
          disabled={formState.isSubmitting}
          aria-busy={formState.isSubmitting}
        >
          {formState.isSubmitting ? t('submitting') : t('submit')}
        </Button>
      </form>

      <SsoButtons returnTo={returnTo} />

      <p style={{ marginTop: 20, textAlign: 'center', fontSize: 13 }}>
        {t('noAccount')}&nbsp;
        <Link href="/auth/sign-up" style={{ fontWeight: 500, textDecoration: 'none' }}>
          {t('signUp')}
        </Link>
      </p>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInPageInner />
    </Suspense>
  );
}
