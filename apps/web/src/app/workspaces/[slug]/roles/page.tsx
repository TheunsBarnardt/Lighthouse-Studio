'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';

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
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Roles</h1>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            Manage roles and permissions for this workspace.
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" type="button">
            New role
          </Button>
        </div>
      </div>

      {loading && (
        <p style={{ fontSize: 13 }} aria-live="polite">
          Loading…
        </p>
      )}

      {!loading && roles.length === 0 && (
        <div
          className="rounded-md border bg-card text-card-foreground p-4"
          style={{ padding: '32px', textAlign: 'center' }}
        >
          <p style={{ fontSize: 13 }}>No roles defined.</p>
        </div>
      )}

      {!loading && roles.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {roles.map((role) => (
            <div key={role.id} className="rounded-md border bg-card text-card-foreground p-4">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                <div>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{role.name}</span>
                  {role.description && (
                    <p style={{ marginTop: 2, fontSize: 13 }}>{role.description}</p>
                  )}
                </div>
                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {role.memberCount} members
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {role.permissions.map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground font-mono text-sm"
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
