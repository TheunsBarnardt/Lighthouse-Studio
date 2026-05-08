'use client';

import { useState } from 'react';

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
    <div className="pg-page" style={{ maxWidth: 1280 }}>
      {/* Header */}
      <div className="pg-page-header">
        <div>
          <h1>Identity Providers</h1>
          <p className="subtitle">
            Configured: {configuredCount} · Available: {availableCount}
          </p>
        </div>
      </div>

      {/* Provider grid */}
      <div className="pg-grid pg-grid-2">
        {PROVIDERS.map((provider) => (
          <div key={provider.id} className="pg-card">
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <strong style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-primary)' }}>
                  {provider.name}
                </strong>
                <span
                  className={
                    provider.status === 'configured'
                      ? 'pg-badge pg-badge-success'
                      : 'pg-badge pg-badge-default'
                  }
                >
                  {provider.status === 'configured' ? 'Configured' : 'Available'}
                </span>
              </div>

              <p style={{ fontSize: 13, color: 'var(--fg-secondary)', margin: 0 }}>
                {provider.description}
              </p>

              {provider.detail && (
                <p style={{ fontSize: 12, color: 'var(--fg-tertiary)', margin: 0 }}>
                  {provider.detail}
                </p>
              )}

              <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
                {provider.status === 'configured' ? (
                  <>
                    <button className="pg-btn pg-btn-secondary pg-btn-xs">Edit</button>
                    <button
                      className="pg-btn pg-btn-ghost pg-btn-xs"
                      style={{ color: 'var(--fg-danger)' }}
                    >
                      Disable
                    </button>
                  </>
                ) : (
                  <button
                    className="pg-btn pg-btn-secondary pg-btn-xs"
                    disabled={configuring === provider.id}
                    onClick={() => {
                      setConfiguring(provider.id);
                    }}
                  >
                    {configuring === provider.id ? 'Configuring…' : 'Configure'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
