'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface AdminWorkspace {
  id: string;
  slug: string;
  name: string;
  memberCount: number;
  createdAt: string;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 36,
  padding: '0 12px',
  borderRadius: 4,
  border: '1px solid var(--border)',
  fontSize: 13,
};

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
    (w) =>
      !search || w.name.toLowerCase().includes(search.toLowerCase()) || w.slug.includes(search),
  );

  return (
    <div style={{ padding: '16px 24px' }}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>All workspaces</h1>
        </div>
      </div>

      <div className="rounded-md border bg-card text-card-foreground p-4">
        <div style={{ padding: '12px 16px' }}>
          <input
            type="search"
            placeholder="Search by name or slugâ€¦"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
            style={inputStyle}
            aria-label="Search workspaces"
          />
        </div>

        {loading && (
          <p
            style={{
              padding: '48px 0',
              textAlign: 'center',
              fontSize: 13,
            }}
            aria-live="polite"
          >
            Loadingâ€¦
          </p>
        )}
        {!loading && filtered.length === 0 && (
          <p
            style={{
              padding: '48px 0',
              textAlign: 'center',
              fontSize: 13,
            }}
          >
            No workspaces found.
          </p>
        )}
        {!loading && filtered.length > 0 && (
          <div className="overflow-hidden rounded-md border" style={{ marginTop: 0 }}>
            <table
              className="w-full border-collapse text-sm"
              role="grid"
              aria-label="All workspaces"
            >
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Slug</th>
                  <th className="tabular-nums">Members</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((ws) => (
                  <tr key={ws.id}>
                    <td>
                      <Link
                        href={`/admin/workspaces/${ws.id}`}
                        style={{
                          fontWeight: 500,
                          textDecoration: 'none',
                        }}
                      >
                        {ws.name}
                      </Link>
                    </td>
                    <td className="font-mono text-sm" style={{ fontSize: 11 }}>
                      {ws.slug}
                    </td>
                    <td className="tabular-nums">{ws.memberCount}</td>
                    <td style={{ fontSize: 12 }}>{new Date(ws.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
