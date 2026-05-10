'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

import type { SessionInfo } from '@/lib/auth-client';

import { Button } from '@/components/ui/button';
import { SessionEventListener } from '@/components/workspace/session-event-listener';
import { useAuth } from '@/context/auth-context';
import { authApi } from '@/lib/auth-client';

export default function SessionsPage() {
  const t = useTranslations('account.sessions');
  const { user, signOut } = useAuth();
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  async function loadSessions() {
    try {
      const result = await authApi.listSessions();
      setSessions(result);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSessions();
  }, []);

  const handleSessionRevoked = useCallback(
    (sessionId: string) => {
      setSessions((prev) => {
        const revoked = prev.find((s) => s.id === sessionId);
        if (revoked?.isCurrent) {
          void signOut();
        }
        return prev.filter((s) => s.id !== sessionId);
      });
    },
    [signOut],
  );

  async function revokeSession(id: string) {
    setRevoking(id);
    try {
      await authApi.revokeSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setRevoking(null);
    }
  }

  async function revokeAll() {
    setRevoking('all');
    try {
      await authApi.revokeAllSessions();
      setSessions([]);
      window.location.href = '/auth/sign-in';
    } finally {
      setRevoking(null);
    }
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleString();
  }

  function parseUserAgent(ua: string | null) {
    if (!ua) return 'Unknown device';
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    return ua.slice(0, 30);
  }

  return (
    <>
      {user && <SessionEventListener userId={user.id} onRevoked={handleSessionRevoked} />}
      <div className="rounded-md border bg-card text-card-foreground p-4">
        <div
          className="mb-3 flex items-center justify-between border-b pb-3"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <h2 className="text-sm font-semibold">{t('title')}</h2>
          {sessions.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => {
                void revokeAll();
              }}
              disabled={revoking === 'all'}
            >
              {t('revokeAll')}
            </Button>
          )}
        </div>
        <div style={{ padding: '1.25rem' }}>
          {loading && (
            <p style={{ fontSize: '0.875rem' }} aria-live="polite">
              Loadingâ€¦
            </p>
          )}
          {!loading && sessions.length === 0 && (
            <p style={{ fontSize: '0.875rem' }}>{t('noSessions')}</p>
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
            aria-label={t('title')}
          >
            {sessions.map((session) => (
              <li
                key={session.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  padding: '0.75rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                      {parseUserAgent(session.userAgent)}
                    </span>
                    {session.isCurrent && (
                      <span
                        className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                        style={{ fontSize: '0.75rem' }}
                      >
                        {t('currentDevice')}
                      </span>
                    )}
                  </div>
                  {session.ipAddress && <p style={{ fontSize: '0.75rem' }}>{session.ipAddress}</p>}
                  <p style={{ fontSize: '0.75rem' }}>
                    {t('lastSeen', { time: formatTime(session.lastSeenAt) })}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => {
                    void revokeSession(session.id);
                  }}
                  disabled={revoking === session.id}
                  aria-label={`${t('revoke')} â€” ${parseUserAgent(session.userAgent)}`}
                >
                  {t('revoke')}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
