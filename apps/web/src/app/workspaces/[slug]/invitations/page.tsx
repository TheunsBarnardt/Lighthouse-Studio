'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

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
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    void fetch(`/api/v1/workspaces/${slug}/invitations`, { credentials: 'include' })
      .then((r) => r.json() as Promise<{ items: Invitation[] }>)
      .then((d) => {
        setInvitations(d.items);
        return;
      })
      .catch(() => {
        /* ignore */
      })
      .finally(() => {
        setLoading(false);
      });
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
    <div style={{ padding: '16px 24px' }}>
      <MemberEventListener
        workspaceId={slug}
        onEvent={() => {
          load();
        }}
      />

      <div className="pg-page-header">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg-primary)', margin: 0 }}>
            Pending invitations
          </h1>
        </div>
      </div>

      <div className="pg-card">
        {loading && (
          <p
            style={{
              padding: '48px 0',
              textAlign: 'center',
              fontSize: 13,
              color: 'var(--fg-tertiary)',
            }}
            aria-live="polite"
          >
            Loading…
          </p>
        )}
        {!loading && invitations.length === 0 && (
          <p
            style={{
              padding: '48px 0',
              textAlign: 'center',
              fontSize: 13,
              color: 'var(--fg-tertiary)',
            }}
          >
            No pending invitations.
          </p>
        )}
        {!loading && invitations.length > 0 && (
          <div className="pg-table-wrap" style={{ marginTop: 0 }}>
            <table className="pg-data-table" role="grid" aria-label="Pending invitations">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Roles</th>
                  <th>Expires</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {invitations.map((inv) => (
                  <tr key={inv.token}>
                    <td style={{ fontWeight: 500 }}>{inv.email}</td>
                    <td style={{ color: 'var(--fg-secondary)', fontSize: 13 }}>
                      {inv.roleIds.join(', ')}
                    </td>
                    <td style={{ color: 'var(--fg-secondary)', fontSize: 12 }}>
                      {new Date(inv.expiresAt).toLocaleDateString()}
                    </td>
                    <td>
                      <button
                        className="pg-btn pg-btn-sm"
                        style={{ background: 'var(--fg-danger)', color: '#fff', border: 'none' }}
                        disabled={revoking === inv.token}
                        onClick={() => {
                          void revoke(inv.token);
                        }}
                      >
                        {revoking === inv.token ? 'Revoking…' : 'Revoke'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
