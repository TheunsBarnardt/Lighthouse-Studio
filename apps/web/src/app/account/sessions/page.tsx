'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/context/auth-context';
import type { SessionInfo } from '@/lib/auth-client';
import { authApi } from '@/lib/auth-client';
import { SessionEventListener } from '@/components/workspace/session-event-listener';

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

  useEffect(() => { void loadSessions(); }, []);

  const handleSessionRevoked = useCallback((sessionId: string) => {
    setSessions((prev) => {
      const revoked = prev.find((s) => s.id === sessionId);
      if (revoked?.isCurrent) {
        void signOut();
      }
      return prev.filter((s) => s.id !== sessionId);
    });
  }, [signOut]);

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
      {user && (
        <SessionEventListener userId={user.id} onRevoked={handleSessionRevoked} />
      )}
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t('title')}</CardTitle>
        {sessions.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => { void revokeAll(); }} disabled={revoking === 'all'}>
            {t('revokeAll')}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {loading && <p className="text-sm text-muted-foreground" aria-live="polite">Loading…</p>}
        {!loading && sessions.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('noSessions')}</p>
        )}
        <ul className="space-y-3" aria-label={t('title')}>
          {sessions.map((session) => (
            <li key={session.id} className="flex items-start justify-between rounded-lg border p-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{parseUserAgent(session.userAgent)}</span>
                  {session.isCurrent && (
                    <Badge variant="secondary" className="text-xs">{t('currentDevice')}</Badge>
                  )}
                </div>
                {session.ipAddress && (
                  <p className="text-xs text-muted-foreground">{session.ipAddress}</p>
                )}
                <p className="text-xs text-muted-foreground">{t('lastSeen', { time: formatTime(session.lastSeenAt) })}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { void revokeSession(session.id); }}
                disabled={revoking === session.id}
                aria-label={`${t('revoke')} — ${parseUserAgent(session.userAgent)}`}
              >
                {t('revoke')}
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
    </>
  );
}
