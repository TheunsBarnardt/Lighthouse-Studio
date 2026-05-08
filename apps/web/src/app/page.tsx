'use client';

import Link from 'next/link';

import { useAuth } from '@/context/auth-context';

// ---------------------------------------------------------------------------
// Types & static data
// ---------------------------------------------------------------------------

interface Project {
  id: string;
  name: string;
  status: 'active' | 'live' | 'in_review' | 'pending' | 'failed';
  created: string;
  cost: number;
  stage: string;
}

const PROJECTS: Project[] = [
  {
    id: 'crm-001',
    name: 'Internal Sales CRM',
    status: 'active',
    created: '2026-04-15',
    cost: 23.4,
    stage: 'ui-generation',
  },
  {
    id: 'blog-001',
    name: 'Marketing Blog',
    status: 'live',
    created: '2026-02-08',
    cost: 41.2,
    stage: 'maintenance',
  },
];

const STATUS_BADGE: Record<Project['status'], { cls: string; label: string }> = {
  active: { cls: 'pg-badge pg-badge-info', label: 'In Progress' },
  live: { cls: 'pg-badge pg-badge-success', label: 'Live' },
  in_review: { cls: 'pg-badge pg-badge-warning', label: 'In Review' },
  pending: { cls: 'pg-badge pg-badge-default', label: 'Pending' },
  failed: { cls: 'pg-badge pg-badge-danger', label: 'Failed' },
};

const RECENT_ACTIVITY = [
  { title: 'UI generated for Internal Sales CRM', detail: '14 components · $18.50 · 12 min ago' },
  { title: 'Schema deployed to dev', detail: 'Marketing Blog · 2 hours ago' },
  { title: 'PRD section approved', detail: 'Functional Requirements · Yesterday' },
];

const QUICK_START = [
  {
    icon: '▦',
    label: 'Table Editor',
    description: 'Browse and edit your data',
    href: '/data-management',
  },
  {
    icon: '◰',
    label: 'Schema Designer',
    description: 'Design your database visually',
    href: '/schema-designer',
  },
  {
    icon: '✦',
    label: 'AI Pipeline',
    description: 'Build with the AI loop',
    href: '/ai-pipeline/intent-capture',
  },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HomePage() {
  const { user } = useAuth();
  const firstName = user?.displayName?.split(' ')[0] ?? null;

  return (
    <div className="pg-page" style={{ maxWidth: 1280 }}>
      {/* Page header */}
      <div className="pg-page-header">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--fg-primary)', margin: 0 }}>
            Welcome back{firstName ? `, ${firstName}` : ''}
          </h1>
          <div style={{ fontSize: 13, color: 'var(--fg-secondary)', marginTop: 4 }}>
            Workspace: Acme Corporation · Database: PostgreSQL
          </div>
        </div>
        <div className="pg-page-header-actions">
          <Link href="/workspaces">
            <button className="pg-btn pg-btn-secondary pg-btn-sm">Switch workspace</button>
          </Link>
          <Link href="/ai-pipeline/intent-capture">
            <button className="pg-btn pg-btn-primary pg-btn-sm">+ New project</button>
          </Link>
        </div>
      </div>

      {/* Stats row */}
      <div className="pg-grid pg-grid-4" style={{ marginBottom: 24 }}>
        <div className="pg-stat-card">
          <div className="pg-stat-label">Active projects</div>
          <div className="pg-stat-value">{PROJECTS.length}</div>
          <div className="pg-stat-delta pg-stat-up">+1 this month</div>
        </div>
        <div className="pg-stat-card">
          <div className="pg-stat-label">Database tables</div>
          <div className="pg-stat-value">21</div>
          <div className="pg-stat-delta pg-stat-up">+4 this week</div>
        </div>
        <div className="pg-stat-card">
          <div className="pg-stat-label">API requests · 24h</div>
          <div className="pg-stat-value">142,503</div>
          <div className="pg-stat-delta" style={{ color: 'var(--fg-secondary)' }}>
            p95 87ms
          </div>
        </div>
        <div className="pg-stat-card">
          <div className="pg-stat-label">AI spend · month</div>
          <div className="pg-stat-value">$23.40</div>
          <div className="pg-stat-delta" style={{ color: 'var(--fg-secondary)' }}>
            of $50 budget
          </div>
        </div>
      </div>

      {/* Recent projects + Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Recent projects */}
        <div className="pg-card">
          <div className="pg-card-header">
            <div className="pg-card-title">Recent projects</div>
            <Link href="/ai-pipeline">
              <button className="pg-btn pg-btn-ghost pg-btn-sm">View all</button>
            </Link>
          </div>
          <div className="pg-table-wrap">
            <table className="pg-data-table">
              <tbody>
                {PROJECTS.map((p) => {
                  const s = STATUS_BADGE[p.status];
                  return (
                    <tr key={p.id} style={{ cursor: 'pointer' }}>
                      <td>
                        <Link
                          href={`/ai-pipeline/${p.stage}`}
                          style={{
                            fontWeight: 600,
                            color: 'var(--fg-primary)',
                            textDecoration: 'none',
                          }}
                        >
                          {p.name}
                        </Link>
                      </td>
                      <td>
                        <span className={s.cls}>{s.label}</span>
                      </td>
                      <td
                        className="pg-tabular"
                        style={{ fontSize: 12, color: 'var(--fg-secondary)' }}
                      >
                        {p.created}
                      </td>
                      <td
                        className="pg-tabular"
                        style={{ fontSize: 12, color: 'var(--fg-secondary)' }}
                      >
                        ${p.cost.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent activity */}
        <div className="pg-card">
          <div className="pg-card-header">
            <div className="pg-card-title">Recent activity</div>
          </div>
          <div style={{ padding: '0 16px 16px', fontSize: 13 }}>
            {RECENT_ACTIVITY.map((a, i) => (
              <div key={i} style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 500, color: 'var(--fg-primary)' }}>{a.title}</div>
                <div style={{ fontSize: 11, color: 'var(--fg-tertiary)', marginTop: 2 }}>
                  {a.detail}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick start */}
      <div className="pg-card">
        <div className="pg-card-header">
          <div className="pg-card-title">Quick start</div>
        </div>
        <div className="pg-grid pg-grid-3" style={{ padding: '0 16px 16px' }}>
          {QUICK_START.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div className="pg-card" style={{ cursor: 'pointer' }}>
                <div style={{ fontSize: 18, color: 'var(--accent-primary)' }}>{item.icon}</div>
                <div style={{ fontWeight: 600, marginTop: 8, color: 'var(--fg-primary)' }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 12, color: 'var(--fg-secondary)', marginTop: 2 }}>
                  {item.description}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
