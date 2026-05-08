'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

export default function PreferencesPage() {
  const t = useTranslations('account.preferences');
  const [saved, setSaved] = useState(false);

  return (
    <div className="pg-card">
      <div className="pg-card-header">
        <h2 className="pg-card-title">{t('title')}</h2>
      </div>
      <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--fg-primary)' }}>
            {t('languageLabel')}
          </span>
          <p style={{ fontSize: '0.875rem', color: 'var(--fg-secondary)' }}>
            English (only language available in v1)
          </p>
        </div>

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

        <div>
          <button
            type="button"
            className="pg-btn pg-btn-primary"
            onClick={() => {
              setSaved(true);
            }}
          >
            {t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}
