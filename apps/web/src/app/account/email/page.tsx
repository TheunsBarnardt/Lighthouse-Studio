'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/auth-context';

const EmailSchema = z.object({
  newEmail: z.string().email('Enter a valid email address'),
});

export default function EmailPage() {
  const t = useTranslations('account.email');
  const { user } = useAuth();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const form = useForm({ resolver: zodResolver(EmailSchema), defaultValues: { newEmail: '' } });
  const {
    formState: { errors, isSubmitting },
  } = form;

  async function onSubmit(values: { newEmail: string }) {
    setError(null);
    try {
      const res = await fetch('/api/v1/me/email', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail: values.newEmail }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        setError(body.message ?? 'Failed.');
        return;
      }
      setPending(values.newEmail);
      form.reset();
    } catch {
      setError('Failed to request email change.');
    }
  }

  return (
    <div className="rounded-md border bg-card text-card-foreground p-4">
      <div className="mb-3 flex items-center justify-between border-b pb-3">
        <h2 className="text-sm font-semibold">{t('title')}</h2>
      </div>
      <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <p style={{ fontSize: '0.875rem' }}>{t('currentEmail', { email: user?.email ?? '—' })}</p>

        {pending && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              border: '1px solid var(--fg-success)',
              background: 'color-mix(in srgb, var(--fg-success) 8%, transparent)',
              fontSize: '0.875rem',
            }}
          >
            {t('pending', { email: pending })}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit(onSubmit)(e);
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
          noValidate
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <label htmlFor="newEmail" style={{ fontSize: '0.8125rem', fontWeight: 500 }}>
              {t('newEmailLabel')}
            </label>
            <input
              id="newEmail"
              type="email"
              placeholder={t('newEmailPlaceholder')}
              aria-required
              aria-invalid={!!errors.newEmail}
              style={{
                padding: '0.4375rem 0.75rem',
                border: '1px solid var(--border-default)',
                borderRadius: '6px',
                fontSize: '0.875rem',
                outline: 'none',
              }}
              {...form.register('newEmail')}
            />
            {errors.newEmail && (
              <span style={{ fontSize: '0.8125rem' }}>{errors.newEmail.message}</span>
            )}
          </div>

          {error && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '6px',
                border: '1px solid var(--fg-danger)',
                background: 'color-mix(in srgb, var(--fg-danger) 8%, transparent)',
                fontSize: '0.875rem',
              }}
            >
              {error}
            </div>
          )}

          <div>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('submitting') : t('submit')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
