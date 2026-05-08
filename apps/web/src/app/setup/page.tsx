'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { notFound } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const SetupSchema = z.object({
  displayName: z.string().min(1, 'Name is required'),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  workspaceName: z.string().min(1, 'Workspace name is required'),
  workspaceSlug: z
    .string()
    .min(1, 'Workspace slug is required')
    .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers and hyphens'),
});

type SetupValues = z.infer<typeof SetupSchema>;

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 36,
  padding: '0 12px',
  borderRadius: 4,
  border: '1px solid var(--border-default)',
  background: 'var(--bg-canvas)',
  color: 'var(--fg-primary)',
  fontSize: 13,
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--fg-secondary)',
  marginBottom: 6,
};

export default function SetupPage() {
  const t = useTranslations('setup');
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SetupValues>({
    resolver: zodResolver(SetupSchema),
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
      workspaceName: '',
      workspaceSlug: '',
    },
  });

  useEffect(() => {
    void fetch('/api/v1/setup/status', { credentials: 'include' })
      .then((r) => r.json() as Promise<{ initialized: boolean }>)
      .then((d) => {
        if (d.initialized) {
          notFound();
        }
        return;
      })
      .catch(() => {
        /* allow setup to proceed if status check fails */
      })
      .finally(() => {
        setChecking(false);
      });
  }, []);

  function slugify(value: string): string {
    return value
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  }

  const workspaceName = watch('workspaceName');

  async function onSubmit(values: SetupValues) {
    setError(null);
    const res = await fetch('/api/v1/setup', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = (await res.json()) as { message?: string };
      setError(body.message ?? 'Setup failed. Please try again.');
      return;
    }
    const data = (await res.json()) as { workspaceSlug?: string };
    router.replace(data.workspaceSlug ? `/workspaces/${data.workspaceSlug}` : '/');
  }

  if (checking) {
    return (
      <div
        style={{
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 192,
            height: 4,
            borderRadius: 2,
            background: 'var(--bg-surface)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: '60%',
              height: '100%',
              background: 'var(--accent-primary)',
              borderRadius: 2,
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-canvas)',
        padding: '0 16px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--fg-primary)', margin: 0 }}>
            {t('title')}
          </h1>
          <p style={{ marginTop: 8, fontSize: 13, color: 'var(--fg-secondary)' }}>
            {t('subtitle')}
          </p>
        </div>

        <div className="pg-card" style={{ padding: 32 }}>
          <form
            onSubmit={(e) => {
              void handleSubmit(onSubmit)(e);
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            noValidate
          >
            <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-primary)', margin: 0 }}>
              {t('ownerSectionTitle')}
            </h2>

            <div>
              <label htmlFor="displayName" style={labelStyle}>
                {t('ownerNameLabel')}
              </label>
              <input
                id="displayName"
                style={inputStyle}
                placeholder={t('ownerNamePlaceholder')}
                autoComplete="name"
                {...register('displayName')}
              />
              {errors.displayName && (
                <p style={{ marginTop: 4, fontSize: 11, color: 'var(--fg-danger)' }}>
                  {errors.displayName.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="email" style={labelStyle}>
                {t('emailLabel')}
              </label>
              <input
                id="email"
                type="email"
                style={inputStyle}
                placeholder={t('emailPlaceholder')}
                autoComplete="email"
                aria-required
                {...register('email')}
              />
              {errors.email && (
                <p style={{ marginTop: 4, fontSize: 11, color: 'var(--fg-danger)' }}>
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="password" style={labelStyle}>
                {t('passwordLabel')}
              </label>
              <input
                id="password"
                type="password"
                style={inputStyle}
                placeholder={t('passwordPlaceholder')}
                autoComplete="new-password"
                aria-required
                {...register('password')}
              />
              {errors.password && (
                <p style={{ marginTop: 4, fontSize: 11, color: 'var(--fg-danger)' }}>
                  {errors.password.message}
                </p>
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: 16 }}>
              <h2
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--fg-primary)',
                  margin: '0 0 16px',
                }}
              >
                {t('workspaceSectionTitle')}
              </h2>

              <div style={{ marginBottom: 12 }}>
                <label htmlFor="workspaceName" style={labelStyle}>
                  {t('workspaceNameLabel')}
                </label>
                <input
                  id="workspaceName"
                  style={inputStyle}
                  placeholder={t('workspaceNamePlaceholder')}
                  {...register('workspaceName', {
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                      const currentSlug = slugify(workspaceName);
                      const newSlug = slugify(e.target.value);
                      // Auto-fill slug if it was derived from workspace name
                      if (!workspaceName || currentSlug === slugify(workspaceName)) {
                        setValue('workspaceSlug', newSlug);
                      }
                    },
                  })}
                />
                {errors.workspaceName && (
                  <p style={{ marginTop: 4, fontSize: 11, color: 'var(--fg-danger)' }}>
                    {errors.workspaceName.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="workspaceSlug" style={labelStyle}>
                  {t('workspaceSlugLabel')}
                </label>
                <input
                  id="workspaceSlug"
                  style={inputStyle}
                  placeholder={t('workspaceSlugPlaceholder')}
                  {...register('workspaceSlug')}
                />
                <p style={{ marginTop: 4, fontSize: 11, color: 'var(--fg-tertiary)' }}>
                  {t('workspaceSlugHint')}
                </p>
                {errors.workspaceSlug && (
                  <p style={{ marginTop: 4, fontSize: 11, color: 'var(--fg-danger)' }}>
                    {errors.workspaceSlug.message}
                  </p>
                )}
              </div>
            </div>

            {error && (
              <div
                role="alert"
                style={{
                  borderRadius: 4,
                  background: 'var(--bg-danger-subtle)',
                  padding: '10px 12px',
                  fontSize: 13,
                  color: 'var(--fg-danger)',
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              className="pg-btn pg-btn-primary"
              style={{ width: '100%' }}
              disabled={isSubmitting}
            >
              {isSubmitting ? t('submitting') : t('submit')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
