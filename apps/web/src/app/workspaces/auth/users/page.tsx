'use client';

import { useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuthUser {
  name: string;
  email: string;
  role: string;
  provider: string;
  mfa: string;
  lastSignIn: string;
  initials: string;
  status: 'active' | 'banned' | 'suspended';
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const USERS: AuthUser[] = [
  {
    name: 'Joana de Klerk',
    email: 'joana@acme.com',
    role: 'Workspace Owner',
    provider: 'Email',
    mfa: 'TOTP',
    lastSignIn: 'Just now',
    initials: 'JD',
    status: 'active',
  },
  {
    name: 'Marcus Acker',
    email: 'marcus@acme.com',
    role: 'Architect',
    provider: 'Entra ID',
    mfa: 'TOTP',
    lastSignIn: '12 min ago',
    initials: 'MA',
    status: 'active',
  },
  {
    name: 'Priya Singh',
    email: 'priya@acme.com',
    role: 'Business Analyst',
    provider: 'Entra ID',
    mfa: 'TOTP',
    lastSignIn: '1 hour ago',
    initials: 'PS',
    status: 'active',
  },
  {
    name: 'Tom Müller',
    email: 'tom@acme.com',
    role: 'Developer',
    provider: 'Entra ID',
    mfa: 'TOTP',
    lastSignIn: '2 hours ago',
    initials: 'TM',
    status: 'active',
  },
  {
    name: 'Sara Chen',
    email: 'sara@acme.com',
    role: 'QA',
    provider: 'Email',
    mfa: '—',
    lastSignIn: 'Yesterday',
    initials: 'SC',
    status: 'active',
  },
  {
    name: 'Liam Walsh',
    email: 'liam@acme.com',
    role: 'Reviewer',
    provider: 'Entra ID',
    mfa: 'TOTP',
    lastSignIn: '3 days ago',
    initials: 'LW',
    status: 'banned',
  },
];

function statusBadgeClass(status: AuthUser['status']): string {
  if (status === 'active') return 'pg-badge pg-badge-success';
  if (status === 'banned') return 'pg-badge pg-badge-danger';
  return 'pg-badge pg-badge-warning';
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AuthUsersPage() {
  const [search, setSearch] = useState('');

  const filtered = USERS.filter(
    (u) =>
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="pg-page" style={{ maxWidth: 1280 }}>
      {/* Header */}
      <div className="pg-page-header">
        <div>
          <h1>Users</h1>
          <p className="subtitle">{USERS.length} members · Identity provider: Microsoft Entra ID</p>
        </div>
        <div className="pg-page-header-actions">
          <input
            type="search"
            className="input input-h28"
            placeholder="Search users…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
            aria-label="Search users"
            style={{ width: 220 }}
          />
          <button className="pg-btn pg-btn-primary pg-btn-sm">+ Invite user</button>
        </div>
      </div>

      {/* Table */}
      <div className="pg-table-wrap">
        <table className="pg-data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Provider</th>
              <th>MFA</th>
              <th>Last sign-in</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    textAlign: 'center',
                    padding: '40px 16px',
                    color: 'var(--fg-secondary)',
                    fontSize: 13,
                  }}
                >
                  No users match your search.
                </td>
              </tr>
            ) : (
              filtered.map((user) => (
                <tr key={user.email}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="avatar" aria-hidden="true">
                        {user.initials}
                      </div>
                      <strong style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-primary)' }}>
                        {user.name}
                      </strong>
                    </div>
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--fg-secondary)' }}>{user.email}</td>
                  <td>
                    <span className="pg-badge pg-badge-default">{user.role}</span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>{user.provider}</td>
                  <td>
                    {user.mfa === '—' ? (
                      <span style={{ color: 'var(--fg-tertiary)' }}>—</span>
                    ) : (
                      <span style={{ color: 'var(--fg-success)' }}>✓ {user.mfa}</span>
                    )}
                  </td>
                  <td className="pg-tabular" style={{ fontSize: 12, color: 'var(--fg-tertiary)' }}>
                    {user.lastSignIn}
                  </td>
                  <td>
                    <span className={statusBadgeClass(user.status)}>
                      {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
