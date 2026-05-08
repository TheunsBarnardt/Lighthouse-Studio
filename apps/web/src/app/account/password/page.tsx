'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const ChangePasswordSchema = z
  .object({
    current: z.string().min(1, 'Current password is required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm: z.string().min(1, 'Confirm your password'),
  })
  .refine((v) => v.password === v.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });

export default function PasswordPage() {
  const t = useTranslations('account.password');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    resolver: zodResolver(ChangePasswordSchema),
    defaultValues: { current: '', password: '', confirm: '' },
  });

  const {
    formState: { errors, isSubmitting },
  } = form;

  async function onSubmit(values: { current: string; password: string }) {
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/v1/me/password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: values.current, newPassword: values.password }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        setError(body.message ?? 'Failed to change password.');
        return;
      }
      setSaved(true);
      form.reset();
    } catch {
      setError('Failed to change password.');
    }
  }

  const fieldStyle = {
    padding: '0.4375rem 0.75rem',
    border: '1px solid var(--border-default)',
    borderRadius: '6px',
    background: 'var(--bg-canvas)',
    color: 'var(--fg-primary)',
    fontSize: '0.875rem',
    outline: 'none',
    width: '100%',
  } as const;

  const labelStyle = {
    fontSize: '0.8125rem',
    fontWeight: 500,
    color: 'var(--fg-primary)',
  } as const;

  return (
    <div className="pg-card">
      <div className="pg-card-header">
        <h2 className="pg-card-title">{t('title')}</h2>
      </div>
      <div style={{ padding: '1.25rem' }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit(onSubmit)(e);
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
          noValidate
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <label htmlFor="current" style={labelStyle}>
              {t('currentLabel')}
            </label>
            <input
              id="current"
              type="password"
              autoComplete="current-password"
              aria-required
              aria-invalid={!!errors.current}
              style={fieldStyle}
              {...form.register('current')}
            />
            {errors.current && (
              <span style={{ fontSize: '0.8125rem', color: 'var(--fg-danger)' }}>
                {errors.current.message}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <label htmlFor="password" style={labelStyle}>
              {t('newLabel')}
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              aria-required
              aria-invalid={!!errors.password}
              style={fieldStyle}
              {...form.register('password')}
            />
            {errors.password && (
              <span style={{ fontSize: '0.8125rem', color: 'var(--fg-danger)' }}>
                {errors.password.message}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <label htmlFor="confirm" style={labelStyle}>
              {t('confirmLabel')}
            </label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              aria-required
              aria-invalid={!!errors.confirm}
              style={fieldStyle}
              {...form.register('confirm')}
            />
            {errors.confirm && (
              <span style={{ fontSize: '0.8125rem', color: 'var(--fg-danger)' }}>
                {errors.confirm.message}
              </span>
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
                color: 'var(--fg-danger)',
              }}
            >
              {error}
            </div>
          )}
          {saved && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '6px',
                border: '1px solid var(--fg-success)',
                background: 'color-mix(in srgb, var(--fg-success) 8%, transparent)',
                fontSize: '0.875rem',
                color: 'var(--fg-success)',
              }}
            >
              {t('saved')}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button type="submit" className="pg-btn pg-btn-primary" disabled={isSubmitting}>
              {isSubmitting ? t('saving') : t('save')}
            </button>
            <Link
              href="/auth/forgot-password"
              style={{ fontSize: '0.875rem', color: 'var(--fg-secondary)', textDecoration: 'none' }}
            >
              {t('forgotCurrent')}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
