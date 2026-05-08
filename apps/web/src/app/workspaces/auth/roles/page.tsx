'use client';

import { useState } from 'react';

interface Role {
  name: string;
  memberCount: number;
  permissions: string;
  description: string;
}

const ROLES: Role[] = [
  {
    name: 'Workspace Owner',
    memberCount: 1,
    permissions: 'All permissions',
    description: 'Full access including billing and workspace deletion',
  },
  {
    name: 'Admin',
    memberCount: 1,
    permissions: '127 permissions',
    description: 'Most actions; cannot delete workspace or change billing',
  },
  {
    name: 'Architect',
    memberCount: 1,
    permissions: '94 permissions',
    description: 'Schema and deployment access; full data plane',
  },
  {
    name: 'Business Analyst',
    memberCount: 1,
    permissions: '42 permissions',
    description: 'Intent and PRD authorship; review and approve requirements',
  },
  {
    name: 'Developer',
    memberCount: 1,
    permissions: '78 permissions',
    description: 'Code generation and deployment',
  },
  {
    name: 'QA',
    memberCount: 1,
    permissions: '38 permissions',
    description: 'Test generation and approval; read access to all stages',
  },
  {
    name: 'Reviewer',
    memberCount: 1,
    permissions: '24 permissions',
    description: 'Read-only with approval rights at configured gates',
  },
];

export default function AuthRolesPage() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="pg-page" style={{ maxWidth: 1280 }}>
      {/* Header */}
      <div className="pg-page-header">
        <div>
          <h1>Roles &amp; Permissions</h1>
          <p className="subtitle">{ROLES.length} roles · 142 permissions defined</p>
        </div>
        <div className="pg-page-header-actions">
          <button className="pg-btn pg-btn-primary pg-btn-sm">+ New role</button>
        </div>
      </div>

      {/* Grid of role cards */}
      <div className="pg-grid pg-grid-2">
        {ROLES.map((role) => (
          <div
            key={role.name}
            className="pg-card"
            style={{
              cursor: 'pointer',
              ...(selected === role.name
                ? {
                    borderColor: 'var(--accent-primary)',
                    boxShadow: '0 0 0 2px var(--accent-primary)',
                  }
                : {}),
            }}
            onClick={() => {
              setSelected(selected === role.name ? null : role.name);
            }}
          >
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <strong style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-primary)' }}>
                  {role.name}
                </strong>
                <span className="pg-badge pg-badge-default">
                  {role.memberCount} {role.memberCount === 1 ? 'member' : 'members'}
                </span>
              </div>

              <p style={{ fontSize: 13, color: 'var(--fg-secondary)', margin: 0 }}>
                {role.description}
              </p>

              <p style={{ fontSize: 12, color: 'var(--fg-tertiary)', margin: 0 }}>
                {role.permissions}
              </p>

              {selected === role.name && (
                <div style={{ display: 'flex', gap: 8, paddingTop: 8 }}>
                  <button
                    className="pg-btn pg-btn-secondary pg-btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    Edit role
                  </button>
                  {role.name !== 'Workspace Owner' && (
                    <button
                      className="pg-btn pg-btn-ghost pg-btn-sm"
                      style={{ color: 'var(--fg-danger)' }}
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
