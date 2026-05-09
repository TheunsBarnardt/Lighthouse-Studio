'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { CaptchaWidget } from '@/components/ui/captcha-widget';
import { PasswordRules } from '@/components/ui/password-rules';
import { SsoButtons } from '@/components/ui/sso-buttons';
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

const SignUpSchema = z
  .object({
    displayName: z.string().min(1, 'Display name is required').max(255),
    email: z.string().email('Enter a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type SignUpValues = z.infer<typeof SignUpSchema>;

export default function SignUpPage() {
  const t = useTranslations('auth.signUp');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [verifyNotice, setVerifyNotice] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string>('');

  const form = useForm<SignUpValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- zod 3.25 / hookform 3.10 type incompatibility
    resolver: zodResolver(SignUpSchema as any),
    defaultValues: { displayName: '', email: '', password: '', confirmPassword: '' },
    mode: 'onChange',
  });

  const { formState, watch } = form;
  const passwordValue = watch('password');

  async function onSubmit(values: SignUpValues) {
    setError(null);
    setVerifyNotice(null);
    try {
      const result = await authApi.signUp({
        ...values,
        ...(captchaToken ? { captchaToken } : {}),
      });
      if ('emailVerificationRequired' in result) {
        setVerifyNotice(result.message);
        form.reset();
        return;
      }
      router.push('/');
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : t('error'));
    }
  }

  if (verifyNotice) {
    return (
      <div
        style={{
          padding: 32,
          borderRadius: 8,
          border: '1px solid var(--border-default)',
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>Check your email</h1>
        <p style={{ fontSize: 13, marginBottom: 20 }}>{verifyNotice}</p>
        <p style={{ textAlign: 'center', fontSize: 13 }}>
          <Link href="/auth/sign-in" style={{ textDecoration: 'none' }}>
            {t('signIn')}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 32,
        borderRadius: 8,
        border: '1px solid var(--border-default)',
      }}
    >
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>{t('title')}</h1>

      <form
        onSubmit={(e) => {
          void form.handleSubmit(onSubmit)(e);
        }}
        noValidate
      >
        <div style={fieldStyle}>
          <label htmlFor="displayName" style={labelStyle}>
            {t('displayNameLabel')}
          </label>
          <input
            id="displayName"
            autoComplete="name"
            placeholder={t('displayNamePlaceholder')}
            aria-required
            style={inputStyle}
            {...form.register('displayName')}
          />
          {formState.errors.displayName && (
            <p style={errorStyle}>{formState.errors.displayName.message}</p>
          )}
        </div>

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
          <label htmlFor="password" style={labelStyle}>
            {t('passwordLabel')}
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder={t('passwordPlaceholder')}
            aria-required
            style={inputStyle}
            {...form.register('password')}
          />
          <div style={{ marginTop: 6 }}>
            <PasswordRules value={passwordValue} />
          </div>
        </div>

        <div style={fieldStyle}>
          <label htmlFor="confirmPassword" style={labelStyle}>
            Confirm password
          </label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Repeat your password"
            aria-required
            style={inputStyle}
            {...form.register('confirmPassword')}
          />
          {formState.errors.confirmPassword && (
            <p style={errorStyle}>{formState.errors.confirmPassword.message}</p>
          )}
        </div>

        <div style={{ marginBottom: 14 }}>
          <CaptchaWidget
            onToken={setCaptchaToken}
            onExpire={() => {
              setCaptchaToken('');
            }}
          />
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

        <Button type="submit" style={{ width: '100%' }} disabled={formState.isSubmitting}>
          {formState.isSubmitting ? t('submitting') : t('submit')}
        </Button>
      </form>

      <SsoButtons returnTo="/" />

      <p style={{ marginTop: 20, textAlign: 'center', fontSize: 13 }}>
        {t('alreadyHaveAccount')}&nbsp;
        <Link href="/auth/sign-in" style={{ fontWeight: 500, textDecoration: 'none' }}>
          {t('signIn')}
        </Link>
      </p>
    </div>
  );
}
