'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface AdminUser {
  id: string;
  email: string;
  displayName: string | null;
  status: string;
  mfaEnabled: boolean;
  createdAt: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ q: search, page: '1', limit: '20' });
    void (async () => {
      try {
        const r = await fetch(`/api/v1/admin/users?${params.toString()}`, {
          credentials: 'include',
        });
        const d = (await r.json()) as { items: AdminUser[]; total: number };
        setUsers(d.items);
        setTotal(d.total);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [search]);

  return (
    <div>
      <div
        style={{
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--fg-primary)' }}>
          All users
        </h1>
        <span style={{ fontSize: '0.875rem', color: 'var(--fg-secondary)' }}>{total} total</span>
      </div>

      <div className="pg-card">
        <div className="pg-card-header" style={{ paddingBottom: '0.75rem' }}>
          <input
            type="search"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
            aria-label="Search users"
            style={{
              width: '100%',
              padding: '0.4375rem 0.75rem',
              border: '1px solid var(--border-default)',
              borderRadius: '6px',
              background: 'var(--bg-canvas)',
              color: 'var(--fg-primary)',
              fontSize: '0.875rem',
              outline: 'none',
            }}
          />
        </div>
        <div style={{ padding: '0 1.25rem 1.25rem' }}>
          {loading && (
            <p
              style={{
                padding: '2rem 0',
                textAlign: 'center',
                fontSize: '0.875rem',
                color: 'var(--fg-secondary)',
              }}
              aria-live="polite"
            >
              Loading…
            </p>
          )}
          {!loading && users.length === 0 && (
            <p
              style={{
                padding: '2rem 0',
                textAlign: 'center',
                fontSize: '0.875rem',
                color: 'var(--fg-secondary)',
              }}
            >
              No users found.
            </p>
          )}
          {!loading && users.length > 0 && (
            <div className="pg-table-wrap">
              <table className="pg-data-table" role="grid" aria-label="All users">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>MFA</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <Link
                          href={`/admin/users/${user.id}`}
                          style={{
                            fontWeight: 500,
                            color: 'var(--accent-primary)',
                            textDecoration: 'none',
                          }}
                        >
                          {user.displayName ?? user.email}
                        </Link>
                      </td>
                      <td style={{ color: 'var(--fg-secondary)' }}>{user.email}</td>
                      <td>
                        <span className="pg-badge pg-badge-default">{user.status}</span>
                      </td>
                      <td>
                        {user.mfaEnabled ? (
                          <span className="pg-badge pg-badge-success">Enabled</span>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--fg-tertiary)' }}>
                            Off
                          </span>
                        )}
                      </td>
                      <td style={{ color: 'var(--fg-secondary)' }}>
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
