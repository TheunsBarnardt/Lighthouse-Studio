'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

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
      className="pg-card"
      style={{ borderColor: 'color-mix(in srgb, var(--fg-danger) 30%, transparent)' }}
    >
      <div className="pg-card-header">
        <h2 className="pg-card-title" style={{ color: 'var(--fg-danger)' }}>
          {t('title')}
        </h2>
      </div>
      <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Data export */}
        <div>
          <h3
            style={{
              marginBottom: '0.25rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--fg-primary)',
            }}
          >
            {t('exportData')}
          </h3>
          <p
            style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: 'var(--fg-secondary)' }}
          >
            {t('exportDataDescription')}
          </p>
          <button
            type="button"
            className="pg-btn pg-btn-secondary"
            onClick={() => {
              /* TODO: request data export */
            }}
          >
            {t('export')}
          </button>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border-default)' }} />

        {/* Delete account */}
        <div>
          <h3
            style={{
              marginBottom: '0.25rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--fg-danger)',
            }}
          >
            {t('deleteAccount')}
          </h3>
          <p
            style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: 'var(--fg-secondary)' }}
          >
            {t('deleteAccountDescription')}
          </p>

          <div
            style={{
              marginBottom: '0.75rem',
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              border: '1px solid var(--border-default)',
              fontSize: '0.875rem',
              color: 'var(--fg-secondary)',
            }}
          >
            {t('gracePeriod')}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <label
              htmlFor="delete-confirm"
              style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--fg-primary)' }}
            >
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
                border: '1px solid var(--border-default)',
                borderRadius: '6px',
                background: 'var(--bg-canvas)',
                color: 'var(--fg-primary)',
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
                border: '1px solid var(--fg-danger)',
                background: 'color-mix(in srgb, var(--fg-danger) 8%, transparent)',
                fontSize: '0.875rem',
                color: 'var(--fg-danger)',
              }}
            >
              {deleteError}
            </div>
          )}

          <button
            type="button"
            className="pg-btn pg-btn-primary"
            style={{
              marginTop: '1rem',
              background: canDelete && !deleting ? 'var(--fg-danger)' : undefined,
              borderColor: canDelete && !deleting ? 'var(--fg-danger)' : undefined,
              opacity: !canDelete || deleting ? 0.5 : 1,
              cursor: !canDelete || deleting ? 'not-allowed' : 'pointer',
            }}
            disabled={!canDelete || deleting}
            onClick={() => {
              void handleDelete();
            }}
          >
            {deleting ? 'Deleting…' : t('deleteConfirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
