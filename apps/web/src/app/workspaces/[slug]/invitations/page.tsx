'use client';

import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MemberEventListener } from '@/components/workspace/member-event-listener';

interface Invitation {
  token: string;
  email: string;
  roleIds: string[];
  expiresAt: string;
  createdAt: string;
}

export default function WorkspaceInvitationsPage() {
  const { slug } = useParams<{ slug: string }>();
  const t = useTranslations('workspace.invitations');
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    void fetch(`/api/v1/workspaces/${slug}/invitations`, { credentials: 'include' })
      .then((r) => r.json() as Promise<{ items: Invitation[] }>)
      .then((d) => { setInvitations(d.items); return; })
      .catch(() => { /* ignore */ })
      .finally(() => { setLoading(false); });
  }, [slug]);

  useEffect(load, [load]);

  async function revoke(token: string) {
    setRevoking(token);
    try {
      await fetch(`/api/v1/workspaces/${slug}/invitations`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      load();
    } finally {
      setRevoking(null);
    }
  }

  return (
    <div>
      {/* Listens for invitation accepted/revoked events and refreshes the list live */}
      <MemberEventListener workspaceId={slug} onEvent={() => { load(); }} />

      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
      </div>

      <Card>
        <CardHeader><CardTitle>{t('title')}</CardTitle></CardHeader>
        <CardContent>
          {loading && (
            <p className="py-8 text-center text-sm text-muted-foreground" aria-live="polite">
              {t('loading')}
            </p>
          )}
          {!loading && invitations.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('empty')}</p>
          )}
          {!loading && invitations.length > 0 && (
            <table className="w-full text-sm" role="grid" aria-label={t('title')}>
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">{t('columns.email')}</th>
                  <th className="pb-2 pr-4 font-medium">{t('columns.roles')}</th>
                  <th className="pb-2 pr-4 font-medium">{t('columns.expires')}</th>
                  <th className="pb-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {invitations.map((inv) => (
                  <tr key={inv.token} className="border-b last:border-0">
                    <td className="py-3 pr-4 font-medium">{inv.email}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{inv.roleIds.join(', ')}</td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {new Date(inv.expiresAt).toLocaleDateString()}
                    </td>
                    <td className="py-3">
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={revoking === inv.token}
                        onClick={() => { void revoke(inv.token); }}
                      >
                        {revoking === inv.token ? t('revoking') : t('revoke')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
