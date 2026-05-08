'use client';

import Link from 'next/link';

// eslint-disable-next-line no-restricted-syntax
const DEFAULT_WORKSPACE = process.env['NEXT_PUBLIC_DEFAULT_WORKSPACE_ID'] ?? 'default';

const MEMBERS = [
  {
    name: 'Joana de Klerk',
    email: 'joana@acme.com',
    initials: 'JD',
    role: 'Owner',
    scope: 'all projects',
    last: '12 min ago',
    status: 'active',
  },
  {
    name: 'Marcus Acker',
    email: 'marcus@acme.com',
    initials: 'MA',
    role: 'Admin',
    scope: 'all projects',
    last: '47 min ago',
    status: 'active',
  },
  {
    name: 'Tom Müller',
    email: 'tom@acme.com',
    initials: 'TM',
    role: 'Developer',
    scope: 'CRM, Marketing',
    last: '2h ago',
    status: 'active',
  },
  {
    name: 'Sara Patel',
    email: 'sara@acme.com',
    initials: 'SP',
    role: 'Developer',
    scope: 'Marketing',
    last: 'Yesterday',
    status: 'active',
  },
  {
    name: 'Anand Kumar',
    email: 'anand@acme.com',
    initials: 'AK',
    role: 'Designer',
    scope: 'CRM',
    last: '3 days ago',
    status: 'active',
  },
  {
    name: 'Elena Rojas',
    email: 'elena@acme.com',
    initials: 'ER',
    role: 'Reviewer',
    scope: 'CRM',
    last: '1 week ago',
    status: 'active',
  },
] as const;

const ROLE_BADGE: Record<string, string> = {
  Owner: 'pg-badge-warning',
  Admin: 'pg-badge-accent',
  Developer: 'pg-badge-default',
  Designer: 'pg-badge-default',
  Reviewer: 'pg-badge-default',
};

export default function WorkspacesPage() {
  return (
    <div className="pg-page" style={{ maxWidth: '1280px' }}>
      <div className="pg-page-header">
        <div>
          <h1>Acme Corporation</h1>
          <div className="subtitle">Workspace · 6 members · 2 projects · Plan: Enterprise</div>
        </div>
        <div className="pg-page-header-actions">
          <Link
            href={`/workspaces/${DEFAULT_WORKSPACE}/members`}
            className="pg-btn pg-btn-secondary pg-btn-sm"
          >
            Settings
          </Link>
          <button className="pg-btn pg-btn-primary pg-btn-sm" type="button">
            + Invite member
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="pg-grid pg-grid-4 pg-mb-4">
        <div className="pg-stat-card">
          <div className="pg-stat-label">Members</div>
          <div className="pg-stat-value">6</div>
          <div className="pg-stat-delta pg-text-tertiary">all active</div>
        </div>
        <div className="pg-stat-card">
          <div className="pg-stat-label">Projects</div>
          <div className="pg-stat-value">2</div>
          <div className="pg-stat-delta pg-text-tertiary">CRM, Marketing</div>
        </div>
        <div className="pg-stat-card">
          <div className="pg-stat-label">Pending invites</div>
          <div className="pg-stat-value">1</div>
          <div className="pg-stat-delta pg-text-tertiary">sent 2 days ago</div>
        </div>
        <div className="pg-stat-card">
          <div className="pg-stat-label">Plan</div>
          <div className="pg-stat-value">Ent.</div>
          <div className="pg-stat-delta pg-text-tertiary">unlimited seats</div>
        </div>
      </div>

      {/* Members table */}
      <div className="pg-card pg-mb-4">
        <div className="pg-card-header">
          <div className="pg-card-title">Members</div>
          <div className="pg-text-xs pg-text-tertiary">
            Roles inherit from workspace · per-project overrides allowed
          </div>
        </div>
        <div className="pg-table-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table className="pg-data-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                <th>Project access</th>
                <th>Last active</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {MEMBERS.map((m) => (
                <tr key={m.email}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="pg-avatar">{m.initials}</div>
                      <div>
                        <div className="pg-font-medium" style={{ fontSize: '13px' }}>
                          {m.name}
                        </div>
                        <div className="pg-text-xs pg-text-tertiary">{m.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`pg-badge ${ROLE_BADGE[m.role] ?? 'pg-badge-default'}`}>
                      {m.role}
                    </span>
                  </td>
                  <td className="pg-text-xs pg-text-secondary">{m.scope}</td>
                  <td className="pg-text-tertiary pg-text-xs">{m.last}</td>
                  <td>
                    <span className="pg-badge pg-badge-success">Active</span>
                  </td>
                  <td>
                    <Link
                      href={`/workspaces/${DEFAULT_WORKSPACE}/members`}
                      className="pg-btn pg-btn-ghost pg-btn-xs"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invites + Settings */}
      <div className="pg-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="pg-card">
          <div className="pg-card-header">
            <div className="pg-card-title">Pending invites</div>
          </div>
          <div className="pg-table-wrap" style={{ border: 'none', borderRadius: 0 }}>
            <table className="pg-data-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Sent</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontSize: '13px' }}>priya@acme.com</td>
                  <td>
                    <span className="pg-badge pg-badge-default">Developer</span>
                  </td>
                  <td className="pg-text-tertiary pg-text-xs">2d ago</td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="pg-btn pg-btn-ghost pg-btn-xs" type="button">
                        Resend
                      </button>
                      <button className="pg-btn pg-btn-ghost pg-btn-xs" type="button">
                        Revoke
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="pg-card">
          <div className="pg-card-header">
            <div className="pg-card-title">Workspace settings</div>
          </div>
          <div>
            {[
              { key: 'Workspace ID', val: 'ws_a1b2c3d4', mono: true },
              { key: 'Domain', val: 'acme.platform.local' },
              { key: 'SSO', val: 'Microsoft Entra ID', success: true },
              { key: 'SCIM provisioning', val: 'Enabled', success: true },
              { key: 'Default project role', val: 'Reviewer' },
              { key: '2FA required', val: 'Yes', success: true },
            ].map((row) => (
              <div key={row.key} className="pg-inspector-row">
                <span className="pg-inspector-key">{row.key}</span>
                <span
                  className={`pg-inspector-val${row.mono ? ' pg-mono pg-text-xs' : ''}${row.success ? ' pg-text-success' : ''}`}
                >
                  {row.val}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
