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
  border: '1px solid var(--border-default)',
  background: 'var(--bg-canvas)',
  color: 'var(--fg-primary)',
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
      <div className="pg-page-header">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg-primary)', margin: 0 }}>
            All workspaces
          </h1>
        </div>
      </div>

      <div className="pg-card">
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-default)' }}>
          <input
            type="search"
            placeholder="Search by name or slug…"
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
              color: 'var(--fg-tertiary)',
            }}
            aria-live="polite"
          >
            Loading…
          </p>
        )}
        {!loading && filtered.length === 0 && (
          <p
            style={{
              padding: '48px 0',
              textAlign: 'center',
              fontSize: 13,
              color: 'var(--fg-tertiary)',
            }}
          >
            No workspaces found.
          </p>
        )}
        {!loading && filtered.length > 0 && (
          <div className="pg-table-wrap" style={{ marginTop: 0 }}>
            <table className="pg-data-table" role="grid" aria-label="All workspaces">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Slug</th>
                  <th className="pg-tabular">Members</th>
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
                          color: 'var(--accent-primary)',
                          textDecoration: 'none',
                        }}
                      >
                        {ws.name}
                      </Link>
                    </td>
                    <td className="pg-mono" style={{ fontSize: 11, color: 'var(--fg-secondary)' }}>
                      {ws.slug}
                    </td>
                    <td className="pg-tabular" style={{ color: 'var(--fg-secondary)' }}>
                      {ws.memberCount}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>
                      {new Date(ws.createdAt).toLocaleDateString()}
                    </td>
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
