'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { authApi } from '@/lib/auth-client';

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 36,
  padding: '0 12px',
  borderRadius: 4,
  border: '1px solid var(--border)',
  fontSize: 13,
  boxSizing: 'border-box',
};

const cardStyle: React.CSSProperties = {
  padding: 32,
  borderRadius: 8,
  border: '1px solid var(--border)',
};

const MagicLinkSchema = z.object({ email: z.string().email() });

function MagicLinkPageInner() {
  const t = useTranslations('auth.magicLink');
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');
  const [consumeError, setConsumeError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        await authApi.consumeMagicLink(token);
        router.replace('/');
      } catch {
        setConsumeError(t('invalidToken'));
      }
    })();
  }, [token, router, t]);

  const form = useForm({ resolver: zodResolver(MagicLinkSchema), defaultValues: { email: '' } });
  const { formState } = form;

  async function onSubmit(values: { email: string }) {
    await authApi.requestMagicLink(values.email);
    setSentEmail(values.email);
    setSent(true);
  }

  if (token) {
    return (
      <div style={cardStyle}>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>{t('consumingTitle')}</h1>
        {consumeError ? (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 4,
              border: '1px solid var(--destructive, #dc2626)',
              background: 'oklch(0.97 0.02 25)',
              fontSize: 13,
              color: 'var(--destructive, #dc2626)',
            }}
            aria-live="polite"
          >
            {consumeError}
          </div>
        ) : (
          <p style={{ fontSize: 13 }} aria-live="polite">
            Signing you inâ€¦
          </p>
        )}
      </div>
    );
  }

  if (sent) {
    return (
      <div style={cardStyle}>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>{t('successTitle')}</h1>
        <p style={{ fontSize: 13, marginBottom: 20 }}>
          {t('successMessage', { email: sentEmail })}
        </p>
        <p style={{ textAlign: 'center', fontSize: 13 }}>
          <Link href="/auth/sign-in" style={{ textDecoration: 'none' }}>
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{t('requestTitle')}</h1>
      <p style={{ fontSize: 13, marginBottom: 20 }}>{t('requestSubtitle')}</p>

      <form
        onSubmit={(e) => {
          void form.handleSubmit(onSubmit)(e);
        }}
        noValidate
      >
        <div style={{ marginBottom: 14 }}>
          <label
            htmlFor="email"
            style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 500,
              marginBottom: 4,
            }}
          >
            {t('emailLabel')}
          </label>
          <input
            id="email"
            type="email"
            placeholder={t('emailPlaceholder')}
            aria-required
            style={inputStyle}
            {...form.register('email')}
          />
          {formState.errors.email && (
            <p style={{ fontSize: 12, color: 'var(--destructive, #dc2626)', marginTop: 3 }}>
              {String(formState.errors.email.message)}
            </p>
          )}
        </div>

        <Button type="submit" style={{ width: '100%' }} disabled={formState.isSubmitting}>
          {formState.isSubmitting ? t('submitting') : t('submit')}
        </Button>
      </form>
    </div>
  );
}

export default function MagicLinkPage() {
  return (
    <Suspense>
      <MagicLinkPageInner />
    </Suspense>
  );
}
