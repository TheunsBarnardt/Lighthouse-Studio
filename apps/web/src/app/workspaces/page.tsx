'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Workspace {
  id: string;
  slug: string;
  name: string;
  plan: string;
  memberCount: number;
  dbType: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Mock data (replaced by real API once available)
// ---------------------------------------------------------------------------

const MOCK_WORKSPACES: Workspace[] = [
  {
    id: 'ws_a1b2c3d4',
    slug: 'acme-corp',
    name: 'Acme Corporation',
    plan: 'Enterprise',
    memberCount: 6,
    dbType: 'PostgreSQL',
    createdAt: '2025-03-01T00:00:00Z',
  },
  {
    id: 'ws_b2c3d4e5',
    slug: 'acme-skunkworks',
    name: 'Acme Skunkworks',
    plan: 'Pro',
    memberCount: 3,
    dbType: 'MongoDB',
    createdAt: '2025-07-15T00:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function WorkspacesSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            borderRadius: 'var(--shell-radius-lg)',
            border: '1px solid var(--border-default)',
            padding: 16,
            background: 'var(--bg-canvas)',
          }}
        >
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div
              style={{ height: 14, width: 192, borderRadius: 4, background: 'var(--bg-surface-2)' }}
            />
            <div
              style={{ height: 12, width: 128, borderRadius: 4, background: 'var(--bg-surface-2)' }}
            />
          </div>
          <div
            style={{ height: 22, width: 72, borderRadius: 99, background: 'var(--bg-surface-2)' }}
          />
          <div
            style={{ height: 22, width: 88, borderRadius: 99, background: 'var(--bg-surface-2)' }}
          />
          <div
            style={{ height: 30, width: 56, borderRadius: 6, background: 'var(--bg-surface-2)' }}
          />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch('/api/v1/workspaces', { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error('not ok');
        return r.json() as Promise<{ items: Workspace[] }>;
      })
      .then((d) => {
        setWorkspaces(d.items);
        return;
      })
      .catch(() => {
        setWorkspaces(MOCK_WORKSPACES);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div className="pg-page" style={{ maxWidth: 1280 }}>
      {/* Page header */}
      <div className="pg-page-header">
        <div>
          <h1>Workspaces</h1>
          <p className="subtitle">
            {loading
              ? 'Loading…'
              : `${String(workspaces.length)} workspace${workspaces.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="pg-page-header-actions">
          <button className="pg-btn pg-btn-primary pg-btn-sm">+ New workspace</button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <WorkspacesSkeleton />
      ) : workspaces.length === 0 ? (
        <div className="pg-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <p style={{ fontWeight: 500, color: 'var(--fg-primary)', marginBottom: 8 }}>
            No workspaces yet
          </p>
          <p style={{ fontSize: 13, color: 'var(--fg-secondary)', marginBottom: 16 }}>
            Create your first workspace to get started.
          </p>
          <button className="pg-btn pg-btn-primary pg-btn-sm">+ New workspace</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                borderRadius: 'var(--shell-radius-lg)',
                border: '1px solid var(--border-default)',
                padding: 16,
                background: 'var(--bg-canvas)',
              }}
            >
              {/* Workspace avatar */}
              <div
                style={{
                  display: 'flex',
                  height: 40,
                  width: 40,
                  flexShrink: 0,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 'var(--shell-radius-md)',
                  background: 'var(--accent-primary)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                }}
                aria-hidden="true"
              >
                {ws.name.slice(0, 2).toUpperCase()}
              </div>

              {/* Name + meta */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--fg-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    margin: 0,
                  }}
                >
                  {ws.name}
                </p>
                <p
                  style={{
                    marginTop: 2,
                    fontSize: 12,
                    color: 'var(--fg-tertiary)',
                    margin: '2px 0 0',
                  }}
                >
                  {String(ws.memberCount)} member{ws.memberCount !== 1 ? 's' : ''} ·{' '}
                  <span className="pg-mono">{ws.slug}</span>
                </p>
              </div>

              {/* Plan badge */}
              <span
                className={
                  ws.plan === 'Enterprise'
                    ? 'pg-badge pg-badge-warning'
                    : 'pg-badge pg-badge-default'
                }
              >
                {ws.plan}
              </span>

              {/* DB type badge */}
              <span className="pg-badge pg-badge-default">{ws.dbType}</span>

              {/* Open button */}
              <Link
                href={`/workspaces/${ws.slug}/members`}
                className="pg-btn pg-btn-secondary pg-btn-sm"
              >
                Open
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
