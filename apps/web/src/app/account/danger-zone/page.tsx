'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/auth-context';

export default function DangerZonePage() {
  const t = useTranslations('account.dangerZone');
  const { user } = useAuth();
  const [deleteEmail, setDeleteEmail] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const canDelete = deleteEmail === user?.email;

  async function handleDelete() {
    if (!canDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch('/api/v1/me', {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        setDeleteError(body.message ?? 'Failed.');
        return;
      }
      window.location.href = '/auth/sign-in';
    } catch {
      setDeleteError('Failed to delete account.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="rounded-md border bg-card text-card-foreground p-4"
      style={{ borderColor: 'color-mix(in srgb, var(--destructive) 30%, transparent)' }}
    >
      <div className="mb-3 flex items-center justify-between border-b pb-3">
        <h2 className="text-sm font-semibold">{t('title')}</h2>
      </div>
      <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Data export */}
        <div>
          <h3
            style={{
              marginBottom: '0.25rem',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            {t('exportData')}
          </h3>
          <p style={{ marginBottom: '0.75rem', fontSize: '0.875rem' }}>
            {t('exportDataDescription')}
          </p>
          <Button
            variant="outline"
            type="button"
            onClick={() => {
              /* TODO: request data export */
            }}
          >
            {t('export')}
          </Button>
        </div>

        <hr style={{ border: 'none' }} />

        {/* Delete account */}
        <div>
          <h3
            style={{
              marginBottom: '0.25rem',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            {t('deleteAccount')}
          </h3>
          <p style={{ marginBottom: '0.75rem', fontSize: '0.875rem' }}>
            {t('deleteAccountDescription')}
          </p>

          <div
            style={{
              marginBottom: '0.75rem',
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              fontSize: '0.875rem',
            }}
          >
            {t('gracePeriod')}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <label htmlFor="delete-confirm" style={{ fontSize: '0.8125rem', fontWeight: 500 }}>
              {t('deleteConfirmMessage')}
            </label>
            <input
              id="delete-confirm"
              type="email"
              placeholder={t('deleteConfirmPlaceholder')}
              value={deleteEmail}
              onChange={(e) => {
                setDeleteEmail(e.target.value);
              }}
              aria-required
              style={{
                padding: '0.4375rem 0.75rem',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                fontSize: '0.875rem',
                outline: 'none',
              }}
            />
          </div>

          {deleteError && (
            <div
              style={{
                marginTop: '0.5rem',
                padding: '0.75rem 1rem',
                borderRadius: '6px',
                border: '1px solid var(--destructive)',
                background: 'color-mix(in srgb, var(--destructive) 8%, transparent)',
                fontSize: '0.875rem',
              }}
            >
              {deleteError}
            </div>
          )}

          <Button
            type="button"
            style={{
              marginTop: '1rem',
              background: canDelete && !deleting ? 'var(--destructive)' : undefined,
              borderColor: canDelete && !deleting ? 'var(--destructive)' : undefined,
              opacity: !canDelete || deleting ? 0.5 : 1,
              cursor: !canDelete || deleting ? 'not-allowed' : 'pointer',
            }}
            disabled={!canDelete || deleting}
            onClick={() => {
              void handleDelete();
            }}
          >
            {deleting ? 'Deletingâ€¦' : t('deleteConfirm')}
          </Button>
        </div>
      </div>
    </div>
  );
}
