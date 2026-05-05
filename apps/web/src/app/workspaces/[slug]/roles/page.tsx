'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
      .then((d) => { setRoles(d.items); return; })
      .catch(() => { /* ignore */ })
      .finally(() => { setLoading(false); });
  }, [slug]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Roles</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage roles and permissions for this workspace.
        </p>
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground" aria-live="polite">Loading…</p>
      )}

      {!loading && (
        <div className="space-y-4">
          {roles.length === 0 && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-sm text-muted-foreground">No roles defined.</p>
              </CardContent>
            </Card>
          )}
          {roles.map((role) => (
            <Card key={role.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{role.name}</CardTitle>
                  <Badge variant="secondary">{role.memberCount} members</Badge>
                </div>
                {role.description && (
                  <p className="text-sm text-muted-foreground">{role.description}</p>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1">
                  {role.permissions.map((p) => (
                    <Badge key={p} variant="outline" className="font-mono text-xs">{p}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
