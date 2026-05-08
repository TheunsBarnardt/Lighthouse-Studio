'use client';

import type { JSX } from 'react';

import { useEffect, useState } from 'react';

import { authApi } from '@/lib/auth-client';

// ─── Provider SVG icons ───────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden>
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-current" aria-hidden>
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden>
      <path d="M11.4 2H2v9.4h9.4V2z" fill="#F25022" />
      <path d="M22 2h-9.4v9.4H22V2z" fill="#7FBA00" />
      <path d="M11.4 12.6H2V22h9.4v-9.4z" fill="#00A4EF" />
      <path d="M22 12.6h-9.4V22H22v-9.4z" fill="#FFB900" />
    </svg>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ProviderId = 'google' | 'github' | 'microsoft';

interface ProviderConfig {
  id: ProviderId;
  label: string;
  Icon: () => JSX.Element;
}

const ALL_PROVIDERS: ProviderConfig[] = [
  { id: 'google', label: 'Google', Icon: GoogleIcon },
  { id: 'github', label: 'GitHub', Icon: GitHubIcon },
  { id: 'microsoft', label: 'Microsoft', Icon: MicrosoftIcon },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface SsoButtonsProps {
  returnTo?: string;
}

export function SsoButtons({ returnTo = '/' }: SsoButtonsProps) {
  const [enabled, setEnabled] = useState<Record<ProviderId, boolean> | null>(null);
  const [loading, setLoading] = useState<ProviderId | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch('/api/v1/auth/sso/providers');
        const data = (await r.json()) as Record<ProviderId, boolean>;
        setEnabled(data);
      } catch {
        setEnabled({ google: false, github: false, microsoft: false });
      }
    })();
  }, []);

  // Still loading — render nothing to avoid layout shift
  if (!enabled) return null;

  const active = ALL_PROVIDERS.filter((p) => enabled[p.id]);

  // No providers configured — hide the section entirely
  if (active.length === 0) return null;

  async function handleSso(provider: ProviderId) {
    setError(null);
    setLoading(provider);
    try {
      const { authUrl } = await authApi.beginSso(provider, returnTo);
      window.location.href = authUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : `${provider} sign-in failed.`);
      setLoading(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <div style={{ flex: 1, height: 1, background: 'var(--border-default)' }} />
        <span
          style={{
            padding: '0 8px',
            fontSize: 11,
            textTransform: 'uppercase',
            color: 'var(--fg-tertiary)',
            background: 'var(--bg-surface)',
            whiteSpace: 'nowrap',
          }}
        >
          or continue with
        </span>
        <div style={{ flex: 1, height: 1, background: 'var(--border-default)' }} />
      </div>

      <div
        style={{
          display: 'grid',
          gap: 8,
          gridTemplateColumns:
            active.length === 1 ? '1fr' : active.length === 2 ? '1fr 1fr' : '1fr 1fr 1fr',
        }}
      >
        {active.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className="pg-btn pg-btn-secondary pg-btn-sm"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            disabled={loading !== null}
            aria-label={`Continue with ${label}`}
            onClick={() => void handleSso(id)}
          >
            <Icon />
            {label}
          </button>
        ))}
      </div>

      {error && (
        <p
          style={{ textAlign: 'center', fontSize: 12, color: 'var(--fg-danger, #dc2626)' }}
          aria-live="polite"
        >
          {error}
        </p>
      )}
    </div>
  );
}
