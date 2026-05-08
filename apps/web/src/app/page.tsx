import Link from 'next/link';

const PROJECTS = [
  {
    id: 'crm-001',
    name: 'Internal Sales CRM',
    status: 'active' as const,
    created: '2026-04-15',
    cost: 23.4,
    stage: 'ui-generation',
  },
  {
    id: 'blog-001',
    name: 'Marketing Blog',
    status: 'live' as const,
    created: '2026-02-08',
    cost: 41.2,
    stage: 'maintenance',
  },
];

const STATUS_MAP: Record<string, { cls: string; label: string }> = {
  active: { cls: 'pg-badge-info', label: 'In Progress' },
  live: { cls: 'pg-badge-success', label: 'Live' },
  pending: { cls: 'pg-badge-default', label: 'Pending' },
  in_review: { cls: 'pg-badge-warning', label: 'In Review' },
  failed: { cls: 'pg-badge-danger', label: 'Failed' },
};

const RECENT_ACTIVITY = [
  {
    title: 'UI generated for Internal Sales CRM',
    detail: '14 components · $18.50 · 12 min ago',
  },
  {
    title: 'Schema deployed to dev',
    detail: 'Marketing Blog · 2 hours ago',
  },
  {
    title: 'PRD section approved',
    detail: 'Functional Requirements · Yesterday',
  },
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

export default function HomePage() {
  return (
    <div className="pg-page">
      <div className="pg-page-header">
        <div>
          <h1>Welcome back</h1>
          <div className="subtitle">Workspace: Acme Corporation · Database: PostgreSQL</div>
        </div>
        <div className="pg-page-header-actions">
          <Link href="/workspaces" className="pg-btn pg-btn-secondary pg-btn-sm">
            Switch workspace
          </Link>
          <Link href="/ai-pipeline/intent-capture" className="pg-btn pg-btn-primary pg-btn-sm">
            + New project
          </Link>
        </div>
      </div>

      {/* Stats row */}
      <div className="pg-grid pg-grid-4 pg-mb-6">
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
          <div className="pg-stat-delta pg-text-tertiary">p95 87ms</div>
        </div>
        <div className="pg-stat-card">
          <div className="pg-stat-label">AI spend · month</div>
          <div className="pg-stat-value">$23.40</div>
          <div className="pg-stat-delta pg-text-tertiary">of $50 budget</div>
        </div>
      </div>

      {/* Recent projects + Activity */}
      <div
        className="pg-mb-4"
        style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}
      >
        <div className="pg-card">
          <div className="pg-card-header">
            <div className="pg-card-title">Recent projects</div>
            <Link href="/ai-pipeline" className="pg-btn pg-btn-ghost pg-btn-sm">
              View all
            </Link>
          </div>
          <div className="pg-table-wrap" style={{ border: 'none', borderRadius: 0 }}>
            <table className="pg-data-table">
              <tbody>
                {PROJECTS.map((p) => {
                  const s = STATUS_MAP[p.status] ?? STATUS_MAP.pending;
                  return (
                    <tr key={p.id}>
                      <td>
                        <Link
                          href={`/ai-pipeline/${p.stage}`}
                          style={{
                            fontWeight: 500,
                            color: 'var(--fg-primary)',
                            textDecoration: 'none',
                          }}
                        >
                          {p.name}
                        </Link>
                      </td>
                      <td>
                        <span className={`pg-badge ${s.cls}`}>{s.label}</span>
                      </td>
                      <td className="pg-text-tertiary pg-text-xs pg-tabular">
                        Created {p.created}
                      </td>
                      <td className="pg-text-tertiary pg-text-xs pg-tabular">
                        ${p.cost.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="pg-card">
          <div className="pg-card-header">
            <div className="pg-card-title">Recent activity</div>
          </div>
          <div>
            {RECENT_ACTIVITY.map((a, i) => (
              <div
                key={i}
                className="pg-mb-4"
                style={{ marginBottom: i < RECENT_ACTIVITY.length - 1 ? '16px' : 0 }}
              >
                <div
                  className="pg-font-medium"
                  style={{ fontSize: '13px', color: 'var(--fg-primary)' }}
                >
                  {a.title}
                </div>
                <div className="pg-text-tertiary pg-text-xs" style={{ marginTop: '2px' }}>
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
        <div className="pg-grid pg-grid-3">
          {QUICK_START.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="pg-card"
              style={{
                textDecoration: 'none',
                color: 'inherit',
                cursor: 'pointer',
                transition: 'border-color var(--motion-fast) var(--ease-standard)',
                display: 'block',
              }}
            >
              <div style={{ fontSize: '20px', color: 'var(--accent-primary)' }}>{item.icon}</div>
              <div
                className="pg-font-semibold"
                style={{ marginTop: '8px', fontSize: '13px', color: 'var(--fg-primary)' }}
              >
                {item.label}
              </div>
              <div className="pg-text-secondary pg-text-xs" style={{ marginTop: '4px' }}>
                {item.description}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
