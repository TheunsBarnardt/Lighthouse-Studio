'use client';

const ISSUES = [
  {
    sev: 'high',
    title: 'RLS disabled on 22 tables',
    desc: 'Service-layer auth is in place but DB-level RLS recommended.',
  },
  {
    sev: 'medium',
    title: 'Function `handle_new_user` has SECURITY DEFINER',
    desc: 'Functions with SECURITY DEFINER bypass RLS.',
  },
  {
    sev: 'low',
    title: 'Postgres role `service_role` has broad permissions',
    desc: 'Restrict to API server only.',
  },
];

export default function DbSecurityPage() {
  return (
    <div style={{ padding: '16px 24px' }}>
      <div className="pg-page-header">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg-primary)', margin: 0 }}>
            Security Advisor
          </h1>
          <div style={{ fontSize: 13, color: 'var(--fg-secondary)', marginTop: 4 }}>
            3 issues · Last scan 12 min ago
          </div>
        </div>
        <div className="pg-page-header-actions">
          <button className="pg-btn pg-btn-primary pg-btn-sm">Re-scan</button>
        </div>
      </div>

      {ISSUES.map((issue) => (
        <div key={issue.title} className="pg-card" style={{ marginBottom: 12 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                className={`pg-badge ${issue.sev === 'high' ? 'pg-badge-danger' : issue.sev === 'medium' ? 'pg-badge-warning' : 'pg-badge-default'}`}
              >
                {issue.sev.toUpperCase()}
              </span>
              <strong style={{ fontSize: 13 }}>{issue.title}</strong>
            </div>
            <button className="pg-btn pg-btn-secondary pg-btn-sm">Review</button>
          </div>
          <div style={{ fontSize: 13, color: 'var(--fg-secondary)' }}>{issue.desc}</div>
        </div>
      ))}
    </div>
  );
}
