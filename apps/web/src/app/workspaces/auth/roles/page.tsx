'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';

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
    <div className="mx-auto max-w-[1440px] p-6" style={{ maxWidth: 1280 }}>
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1>Roles &amp; Permissions</h1>
          <p className="subtitle">{ROLES.length} roles · 142 permissions defined</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" type="button">
            + New role
          </Button>
        </div>
      </div>

      {/* Grid of role cards */}
      <div className="grid grid-cols-2 gap-4">
        {ROLES.map((role) => (
          <div
            key={role.name}
            className="rounded-md border bg-card text-card-foreground p-4"
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
                <strong style={{ fontSize: 13, fontWeight: 600 }}>{role.name}</strong>
                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {role.memberCount} {role.memberCount === 1 ? 'member' : 'members'}
                </span>
              </div>

              <p style={{ fontSize: 13, margin: 0 }}>{role.description}</p>

              <p style={{ fontSize: 12, margin: 0 }}>{role.permissions}</p>

              {selected === role.name && (
                <div style={{ display: 'flex', gap: 8, paddingTop: 8 }}>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    Edit role
                  </Button>
                  {role.name !== 'Workspace Owner' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      Delete
                    </Button>
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
