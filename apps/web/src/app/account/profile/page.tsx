'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/auth-context';

const ProfileSchema = z.object({
  displayName: z.string().min(1, 'Display name is required').max(255),
});

export default function ProfilePage() {
  const t = useTranslations('account.profile');
  const { user, refresh } = useAuth();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm({
    resolver: zodResolver(ProfileSchema),
    defaultValues: { displayName: user?.displayName ?? '' },
  });

  const {
    formState: { errors, isSubmitting },
  } = form;

  useEffect(() => {
    if (user) {
      form.reset({ displayName: user.displayName ?? '' });
    }
  }, [user, form]);

  async function onSubmit(values: { displayName: string }) {
    setError(null);
    setSaved(false);
    try {
      await fetch('/api/v1/me/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      await refresh();
      setSaved(true);
    } catch {
      setError('Failed to save profile.');
    }
  }

  function initials(name: string | null, email: string) {
    const n = name ?? email;
    return n.slice(0, 2).toUpperCase();
  }

  return (
    <div className="rounded-md border bg-card text-card-foreground p-4">
      <div className="mb-3 flex items-center justify-between border-b pb-3">
        <h2 className="text-sm font-semibold">{t('title')}</h2>
      </div>
      <div style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <div
            style={{
              width: '4rem',
              height: '4rem',
              borderRadius: '50%',
              background: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
              fontWeight: 600,
              color: '#fff',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.displayName ?? 'Avatar'}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              initials(user?.displayName ?? null, user?.email ?? '')
            )}
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              aria-label={t('uploadAvatar')}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  // TODO: crop then upload via /api/v1/me/avatar
                  void file;
                }
              }}
            />
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => {
                fileInputRef.current?.click();
              }}
            >
              {t('uploadAvatar')}
            </Button>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit(onSubmit)(e);
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
          noValidate
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <label htmlFor="displayName" style={{ fontSize: '0.8125rem', fontWeight: 500 }}>
              {t('displayNameLabel')}
            </label>
            <input
              id="displayName"
              type="text"
              placeholder={t('displayNamePlaceholder')}
              aria-required
              aria-invalid={!!errors.displayName}
              style={{
                padding: '0.4375rem 0.75rem',
                border: '1px solid var(--border-default)',
                borderRadius: '6px',
                fontSize: '0.875rem',
                outline: 'none',
              }}
              {...form.register('displayName')}
            />
            {errors.displayName && (
              <span style={{ fontSize: '0.8125rem' }}>{errors.displayName.message}</span>
            )}
          </div>

          <div>
            <p
              style={{
                marginBottom: '0.25rem',
                fontSize: '0.8125rem',
                fontWeight: 500,
              }}
            >
              {t('emailLabel')}
            </p>
            <p style={{ fontSize: '0.875rem' }}>{user?.email ?? '—'}</p>
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
          {saved && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '6px',
                border: '1px solid var(--fg-success)',
                background: 'color-mix(in srgb, var(--fg-success) 8%, transparent)',
                fontSize: '0.875rem',
              }}
            >
              {t('saved')}
            </div>
          )}

          <div>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('saving') : t('save')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
