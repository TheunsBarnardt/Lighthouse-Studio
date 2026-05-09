'use client';

import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
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
    <div className="rounded-md border bg-card text-card-foreground p-4">
      <div className="mb-3 flex items-center justify-between border-b pb-3">
        <h2 className="text-sm font-semibold">{t('title')}</h2>
      </div>
      <div style={{ padding: '1.25rem' }}>
        {identities.length === 0 && <p style={{ fontSize: '0.875rem' }}>{t('noIdentities')}</p>}

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
                  <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                    {PROVIDER_LABELS[identity.providerId] ?? identity.providerId}
                  </span>
                  {identity.primary && (
                    <span
                      className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                      style={{ fontSize: '0.75rem' }}
                    >
                      {t('primary')}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '0.75rem' }}>{identity.email}</p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {!identity.primary && (
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={() => {
                      /* TODO: make primary */
                    }}
                  >
                    {t('makePrimary')}
                  </Button>
                )}
                {identities.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={() => {
                      /* TODO: unlink */
                    }}
                    aria-label={`${t('unlink')} ${PROVIDER_LABELS[identity.providerId] ?? identity.providerId}`}
                  >
                    {t('unlink')}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>

        <div style={{ marginTop: '1rem' }}>
          <Button
            variant="outline"
            type="button"
            onClick={() => {
              /* TODO: link new provider */
            }}
          >
            {t('link')}
          </Button>
        </div>

        {identities.length <= 1 && (
          <div
            style={{
              marginTop: '1rem',
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              border: '1px solid var(--border-default)',
              fontSize: '0.875rem',
            }}
          >
            {t('cannotUnlinkLast')}
          </div>
        )}
      </div>
    </div>
  );
}
