'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';

interface IdentityProvider {
  id: string;
  name: string;
  status: 'configured' | 'available';
  description: string;
  detail?: string;
}

const PROVIDERS: IdentityProvider[] = [
  {
    id: 'email',
    name: 'Email + Password',
    status: 'configured',
    description: 'Built-in. Argon2id hashing. TOTP MFA available.',
    detail: 'Active · 3 users',
  },
  {
    id: 'entra',
    name: 'Microsoft Entra ID',
    status: 'configured',
    description: 'Tenant: acme.onmicrosoft.com',
    detail: 'Active · 3 users',
  },
  {
    id: 'magic',
    name: 'Magic Link',
    status: 'configured',
    description: 'Email-based passwordless',
    detail: 'Active · 0 users',
  },
  {
    id: 'google',
    name: 'Google OAuth',
    status: 'available',
    description: 'Configure with a Google Cloud OAuth client ID',
  },
  {
    id: 'oidc',
    name: 'Generic OIDC',
    status: 'available',
    description: 'Connect any OIDC-compliant identity provider',
  },
  {
    id: 'saml',
    name: 'SAML 2.0',
    status: 'available',
    description: 'For enterprise identity systems and legacy IdPs',
  },
];

export default function AuthProvidersPage() {
  const [configuring, setConfiguring] = useState<string | null>(null);

  const configuredCount = PROVIDERS.filter((p) => p.status === 'configured').length;
  const availableCount = PROVIDERS.filter((p) => p.status === 'available').length;

  return (
    <div className="mx-auto max-w-[1440px] p-6" style={{ maxWidth: 1280 }}>
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1>Identity Providers</h1>
          <p className="subtitle">
            Configured: {configuredCount} · Available: {availableCount}
          </p>
        </div>
      </div>

      {/* Provider grid */}
      <div className="grid grid-cols-2 gap-4">
        {PROVIDERS.map((provider) => (
          <div key={provider.id} className="rounded-md border bg-card text-card-foreground p-4">
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <strong style={{ fontSize: 13, fontWeight: 600 }}>{provider.name}</strong>
                <span
                  className={
                    provider.status === 'configured'
                      ? 'inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : 'inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground'
                  }
                >
                  {provider.status === 'configured' ? 'Configured' : 'Available'}
                </span>
              </div>

              <p style={{ fontSize: 13, margin: 0 }}>{provider.description}</p>

              {provider.detail && <p style={{ fontSize: 12, margin: 0 }}>{provider.detail}</p>}

              <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
                {provider.status === 'configured' ? (
                  <>
                    <Button variant="outline" size="xs" type="button">
                      Edit
                    </Button>
                    <Button className="" variant="ghost" type="button">
                      Disable
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="xs"
                    type="button"
                    disabled={configuring === provider.id}
                    onClick={() => {
                      setConfiguring(provider.id);
                    }}
                  >
                    {configuring === provider.id ? 'Configuring…' : 'Configure'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
