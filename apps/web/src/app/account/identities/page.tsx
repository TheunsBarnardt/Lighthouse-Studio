'use client';

import { useTranslations } from 'next-intl';

import { useAuth } from '@/context/auth-context';

const PROVIDER_LABELS: Record<string, string> = {
  builtin: 'Email & password',
  memory: 'Email & password',
  google: 'Google',
  github: 'GitHub',
  entra: 'Microsoft Entra',
  oidc: 'OpenID Connect',
  saml: 'SAML',
};

export default function IdentitiesPage() {
  const t = useTranslations('account.identities');
  const { user } = useAuth();
  const identities = user?.identities ?? [];

  return (
    <div className="pg-card">
      <div className="pg-card-header">
        <h2 className="pg-card-title">{t('title')}</h2>
      </div>
      <div style={{ padding: '1.25rem' }}>
        {identities.length === 0 && (
          <p style={{ fontSize: '0.875rem', color: 'var(--fg-secondary)' }}>{t('noIdentities')}</p>
        )}

        <ul
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            listStyle: 'none',
            margin: 0,
            padding: 0,
          }}
        >
          {identities.map((identity) => (
            <li
              key={identity.providerId}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border-default)',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span
                    style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--fg-primary)' }}
                  >
                    {PROVIDER_LABELS[identity.providerId] ?? identity.providerId}
                  </span>
                  {identity.primary && (
                    <span className="pg-badge pg-badge-default" style={{ fontSize: '0.75rem' }}>
                      {t('primary')}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--fg-tertiary)' }}>{identity.email}</p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {!identity.primary && (
                  <button
                    type="button"
                    className="pg-btn pg-btn-ghost pg-btn-sm"
                    onClick={() => {
                      /* TODO: make primary */
                    }}
                  >
                    {t('makePrimary')}
                  </button>
                )}
                {identities.length > 1 && (
                  <button
                    type="button"
                    className="pg-btn pg-btn-ghost pg-btn-sm"
                    onClick={() => {
                      /* TODO: unlink */
                    }}
                    aria-label={`${t('unlink')} ${PROVIDER_LABELS[identity.providerId] ?? identity.providerId}`}
                  >
                    {t('unlink')}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>

        <div style={{ marginTop: '1rem' }}>
          <button
            type="button"
            className="pg-btn pg-btn-secondary"
            onClick={() => {
              /* TODO: link new provider */
            }}
          >
            {t('link')}
          </button>
        </div>

        {identities.length <= 1 && (
          <div
            style={{
              marginTop: '1rem',
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              border: '1px solid var(--border-default)',
              fontSize: '0.875rem',
              color: 'var(--fg-secondary)',
            }}
          >
            {t('cannotUnlinkLast')}
          </div>
        )}
      </div>
    </div>
  );
}
