'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

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
  color: 'var(--fg-secondary)',
};
const valueStyle: React.CSSProperties = { fontSize: 13, color: 'var(--fg-primary)' };

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
      <div
        style={{ padding: '16px 24px', fontSize: 13, color: 'var(--fg-tertiary)' }}
        aria-live="polite"
      >
        Loading…
      </div>
    );
  if (!user)
    return (
      <div style={{ padding: '16px 24px', fontSize: 13, color: 'var(--fg-tertiary)' }}>
        User not found.
      </div>
    );

  return (
    <div style={{ padding: '16px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link
          href="/admin/users"
          style={{ fontSize: 13, color: 'var(--fg-secondary)', textDecoration: 'none' }}
        >
          ← Users
        </Link>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg-primary)', margin: 0 }}>
          {user.displayName ?? user.email}
        </h1>
        <span
          className={`pg-badge ${user.status === 'active' ? 'pg-badge-success' : 'pg-badge-default'}`}
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

      <div className="pg-grid pg-grid-2">
        <div className="pg-card" style={cardStyle}>
          <div className="pg-card-header">
            <span className="pg-card-title">Profile</span>
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

        <div className="pg-card" style={cardStyle}>
          <div className="pg-card-header">
            <span className="pg-card-title">Actions</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {user.status === 'active' ? (
              <button
                className="pg-btn pg-btn-secondary pg-btn-sm"
                style={{ width: '100%' }}
                onClick={() => {
                  void patch({ status: 'suspended' });
                }}
              >
                Suspend account
              </button>
            ) : (
              <button
                className="pg-btn pg-btn-secondary pg-btn-sm"
                style={{ width: '100%' }}
                onClick={() => {
                  void patch({ status: 'active' });
                }}
              >
                Reactivate account
              </button>
            )}
            {user.mfaEnabled && (
              <button
                className="pg-btn pg-btn-secondary pg-btn-sm"
                style={{ width: '100%' }}
                onClick={() => {
                  void patch({ mfaEnabled: false });
                }}
              >
                Reset MFA (admin recovery)
              </button>
            )}
          </div>
        </div>

        <div className="pg-card" style={cardStyle}>
          <div className="pg-card-header">
            <span className="pg-card-title">Linked identities</span>
          </div>
          <div style={{ marginTop: 12 }}>
            {user.identities.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--fg-tertiary)' }}>No linked identities.</p>
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
                    <span
                      className="pg-mono"
                      style={{ fontSize: 11, color: 'var(--fg-secondary)' }}
                    >
                      {i.providerId}:
                    </span>{' '}
                    {i.email}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="pg-card" style={cardStyle}>
          <div className="pg-card-header">
            <span className="pg-card-title">Roles</span>
          </div>
          <div style={{ marginTop: 12 }}>
            {user.roles.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--fg-tertiary)' }}>No roles assigned.</p>
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
