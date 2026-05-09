'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';

interface AdminUserDetail {
  id: string;
  email: string;
  displayName: string | null;
  status: string;
  mfaEnabled: boolean;
  roles: string[];
  identities: Array<{ providerId: string; email: string }>;
  createdAt: string;
  lastSignIn: string | null;
}

const cardStyle: React.CSSProperties = { padding: '16px 20px' };
const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
};
const valueStyle: React.CSSProperties = { fontSize: 13 };

export default function AdminUserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(
    null,
  );

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch(`/api/v1/admin/users/${userId}`, { credentials: 'include' });
        const d = (await r.json()) as AdminUserDetail;
        setUser(d);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  async function patch(updates: Record<string, unknown>) {
    setActionMsg(null);
    const res = await fetch(`/api/v1/admin/users/${userId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const body = (await res.json()) as { message?: string };
      setActionMsg({ kind: 'error', text: body.message ?? 'Action failed.' });
      return;
    }
    setUser((u) => (u ? ({ ...u, ...updates } as AdminUserDetail) : u));
    setActionMsg({ kind: 'success', text: 'Updated.' });
  }

  if (loading)
    return (
      <div style={{ padding: '16px 24px', fontSize: 13 }} aria-live="polite">
        Loading…
      </div>
    );
  if (!user) return <div style={{ padding: '16px 24px', fontSize: 13 }}>User not found.</div>;

  return (
    <div style={{ padding: '16px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link href="/admin/users" style={{ fontSize: 13, textDecoration: 'none' }}>
          ← Users
        </Link>
        <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
          {user.displayName ?? user.email}
        </h1>
        <span
          className={`inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground ${user.status === 'active' ? 'inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground'}`}
        >
          {user.status}
        </span>
      </div>

      {actionMsg && (
        <div
          role="alert"
          style={{
            marginBottom: 16,
            borderRadius: 4,
            padding: '10px 12px',
            fontSize: 13,
            background:
              actionMsg.kind === 'error' ? 'var(--bg-danger-subtle)' : 'var(--bg-success-subtle)',
            color: actionMsg.kind === 'error' ? 'var(--fg-danger)' : 'var(--fg-success)',
          }}
        >
          {actionMsg.text}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-md border bg-card text-card-foreground p-4" style={cardStyle}>
          <div className="mb-3 flex items-center justify-between border-b pb-3">
            <span className="text-sm font-semibold">Profile</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            <div>
              <span style={labelStyle}>Email</span>
              <div style={valueStyle}>{user.email}</div>
            </div>
            <div>
              <span style={labelStyle}>Display name</span>
              <div style={valueStyle}>{user.displayName ?? '—'}</div>
            </div>
            <div>
              <span style={labelStyle}>MFA</span>
              <div style={valueStyle}>{user.mfaEnabled ? 'Enabled' : 'Disabled'}</div>
            </div>
            <div>
              <span style={labelStyle}>Joined</span>
              <div style={valueStyle}>{new Date(user.createdAt).toLocaleDateString()}</div>
            </div>
            <div>
              <span style={labelStyle}>Last sign-in</span>
              <div style={valueStyle}>
                {user.lastSignIn ? new Date(user.lastSignIn).toLocaleString() : 'Never'}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-md border bg-card text-card-foreground p-4" style={cardStyle}>
          <div className="mb-3 flex items-center justify-between border-b pb-3">
            <span className="text-sm font-semibold">Actions</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {user.status === 'active' ? (
              <Button
                variant="outline"
                size="sm"
                type="button"
                style={{ width: '100%' }}
                onClick={() => {
                  void patch({ status: 'suspended' });
                }}
              >
                Suspend account
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                type="button"
                style={{ width: '100%' }}
                onClick={() => {
                  void patch({ status: 'active' });
                }}
              >
                Reactivate account
              </Button>
            )}
            {user.mfaEnabled && (
              <Button
                variant="outline"
                size="sm"
                type="button"
                style={{ width: '100%' }}
                onClick={() => {
                  void patch({ mfaEnabled: false });
                }}
              >
                Reset MFA (admin recovery)
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-md border bg-card text-card-foreground p-4" style={cardStyle}>
          <div className="mb-3 flex items-center justify-between border-b pb-3">
            <span className="text-sm font-semibold">Linked identities</span>
          </div>
          <div style={{ marginTop: 12 }}>
            {user.identities.length === 0 ? (
              <p style={{ fontSize: 13 }}>No linked identities.</p>
            ) : (
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                {user.identities.map((i) => (
                  <li key={i.providerId} style={{ fontSize: 13 }}>
                    <span className="font-mono text-sm" style={{ fontSize: 11 }}>
                      {i.providerId}:
                    </span>{' '}
                    {i.email}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="rounded-md border bg-card text-card-foreground p-4" style={cardStyle}>
          <div className="mb-3 flex items-center justify-between border-b pb-3">
            <span className="text-sm font-semibold">Roles</span>
          </div>
          <div style={{ marginTop: 12 }}>
            {user.roles.length === 0 ? (
              <p style={{ fontSize: 13 }}>No roles assigned.</p>
            ) : (
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                {user.roles.map((r) => (
                  <li key={r} style={{ fontSize: 13 }}>
                    {r}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
