'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  memberCount: number;
}

export default function WorkspaceRolesPage() {
  const { slug } = useParams<{ slug: string }>();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch(`/api/v1/workspaces/${slug}/roles`, { credentials: 'include' })
      .then((r) => r.json() as Promise<{ items: Role[] }>)
      .then((d) => {
        setRoles(d.items);
        return;
      })
      .catch(() => {
        /* ignore */
      })
      .finally(() => {
        setLoading(false);
      });
  }, [slug]);

  return (
    <div style={{ padding: '16px 24px' }}>
      <div className="pg-page-header">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg-primary)', margin: 0 }}>
            Roles
          </h1>
          <div style={{ fontSize: 13, color: 'var(--fg-secondary)', marginTop: 4 }}>
            Manage roles and permissions for this workspace.
          </div>
        </div>
        <div className="pg-page-header-actions">
          <button className="pg-btn pg-btn-primary pg-btn-sm">New role</button>
        </div>
      </div>

      {loading && (
        <p style={{ fontSize: 13, color: 'var(--fg-tertiary)' }} aria-live="polite">
          Loading…
        </p>
      )}

      {!loading && roles.length === 0 && (
        <div className="pg-card" style={{ padding: '32px', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--fg-tertiary)' }}>No roles defined.</p>
        </div>
      )}

      {!loading && roles.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {roles.map((role) => (
            <div key={role.id} className="pg-card">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                <div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-primary)' }}>
                    {role.name}
                  </span>
                  {role.description && (
                    <p style={{ marginTop: 2, fontSize: 13, color: 'var(--fg-secondary)' }}>
                      {role.description}
                    </p>
                  )}
                </div>
                <span className="pg-badge pg-badge-default">{role.memberCount} members</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {role.permissions.map((p) => (
                  <span
                    key={p}
                    className="pg-badge pg-badge-default pg-mono"
                    style={{ fontSize: 10 }}
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
