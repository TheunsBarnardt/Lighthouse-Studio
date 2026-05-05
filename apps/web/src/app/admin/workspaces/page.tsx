'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface AdminWorkspace {
  id: string;
  slug: string;
  name: string;
  memberCount: number;
  createdAt: string;
}

export default function AdminWorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<AdminWorkspace[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch('/api/v1/admin/workspaces', { credentials: 'include' });
        const d = (await r.json()) as { items: AdminWorkspace[] };
        setWorkspaces(d.items);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = workspaces.filter(
    (w) => !search || w.name.toLowerCase().includes(search.toLowerCase()) || w.slug.includes(search),
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">All workspaces</h1>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <Input
            type="search"
            placeholder="Search by name or slug…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); }}
            aria-label="Search workspaces"
          />
        </CardHeader>
        <CardContent>
          {loading && (
            <p className="py-8 text-center text-sm text-muted-foreground" aria-live="polite">Loading…</p>
          )}
          {!loading && filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No workspaces found.</p>
          )}
          {!loading && filtered.length > 0 && (
            <table className="w-full text-sm" role="grid" aria-label="All workspaces">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Name</th>
                  <th className="pb-2 pr-4 font-medium">Slug</th>
                  <th className="pb-2 pr-4 font-medium">Members</th>
                  <th className="pb-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((ws) => (
                  <tr key={ws.id} className="border-b last:border-0">
                    <td className="py-3 pr-4">
                      <Link href={`/workspaces/${ws.slug}/members`} className="font-medium hover:text-primary">
                        {ws.name}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 font-mono text-muted-foreground">{ws.slug}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{ws.memberCount}</td>
                    <td className="py-3 text-muted-foreground">
                      {new Date(ws.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
