'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

export default function PreferencesPage() {
  const t = useTranslations('account.preferences');
  const [saved, setSaved] = useState(false);

  return (
    <div className="rounded-md border bg-card text-card-foreground p-4">
      <div className="mb-3 flex items-center justify-between border-b pb-3">
        <h2 className="text-sm font-semibold">{t('title')}</h2>
      </div>
      <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>{t('languageLabel')}</span>
          <p style={{ fontSize: '0.875rem' }}>English (only language available in v1)</p>
        </div>

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
          <Button
            type="button"
            onClick={() => {
              setSaved(true);
            }}
          >
            {t('save')}
          </Button>
        </div>
      </div>
    </div>
  );
}
