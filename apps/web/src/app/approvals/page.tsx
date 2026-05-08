'use client';

const PENDING = [
  {
    id: 'AP-247',
    stage: 'Stage 9 · Production deploy',
    project: 'Internal Sales CRM',
    requester: 'Marcus Acker',
    requested: '12 min ago',
    mode: 'all_of',
    approved: 1,
    total: 2,
    urgent: true,
    summary: 'v0.1.3 → production. 14 components, 7 functions, 3 schema migrations. Tests passing.',
  },
  {
    id: 'AP-246',
    stage: 'Stage 7 · Code generation',
    project: 'Internal Sales CRM',
    requester: 'AI',
    requested: '47 min ago',
    mode: 'all_of',
    approved: 0,
    total: 2,
    urgent: false,
    summary:
      'Generated `outlookCalendarSync` integration function. 142 lines, sandboxed, OAuth scoped to read+write calendar.',
  },
  {
    id: 'AP-245',
    stage: 'Stage 6 · UI generation',
    project: 'Marketing Blog',
    requester: 'AI',
    requested: '2 hours ago',
    mode: 'any_of',
    approved: 0,
    total: 2,
    urgent: false,
    summary: 'Generated `BlogPostPage` and `RelatedPostsList`. 2 new components.',
  },
  {
    id: 'AP-244',
    stage: 'Stage 2 · PRD section',
    project: 'Internal Sales CRM',
    requester: 'Joana de Klerk',
    requested: '4 hours ago',
    mode: 'all_of',
    approved: 0,
    total: 1,
    urgent: false,
    summary: 'Functional Requirements section · 12 FRs · 3 traced to intent.',
  },
];

const APPROVED = [
  {
    id: 'AP-243',
    what: 'Stage 4 · Schema synthesis',
    project: 'Internal Sales CRM',
    by: 'Marcus, Joana',
    when: '5h ago',
    tta: '42m',
  },
  {
    id: 'AP-242',
    what: 'Stage 3 · Design tokens',
    project: 'Internal Sales CRM',
    by: 'Joana',
    when: '7h ago',
    tta: '2h 4m',
  },
  {
    id: 'AP-241',
    what: 'Stage 9 · Staging deploy',
    project: 'Marketing Blog',
    by: 'Sara, Tom',
    when: 'Yesterday',
    tta: '18m',
  },
  {
    id: 'AP-240',
    what: 'Stage 7 · Code generation',
    project: 'Internal Sales CRM',
    by: 'Marcus, Tom',
    when: 'Yesterday',
    tta: '1h 12m',
  },
];

export default function ApprovalsPage() {
  return (
    <div className="pg-page" style={{ maxWidth: 1280 }}>
      <div className="pg-page-header">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--fg-primary)', margin: 0 }}>
            Approvals
          </h1>
          <div style={{ fontSize: 13, color: 'var(--fg-secondary)', marginTop: 4 }}>
            Single inbox of pending approvals across all projects · 4 pending · 2 awaiting you
          </div>
        </div>
        <div className="pg-page-header-actions">
          <button className="pg-btn pg-btn-secondary pg-btn-sm">Settings</button>
        </div>
      </div>

      {/* Stats */}
      <div className="pg-grid pg-grid-4" style={{ marginBottom: 24 }}>
        <div className="pg-stat-card">
          <div className="pg-stat-label">Pending</div>
          <div className="pg-stat-value">4</div>
          <div className="pg-stat-delta" style={{ color: 'var(--fg-secondary)' }}>
            across 2 projects
          </div>
        </div>
        <div className="pg-stat-card">
          <div className="pg-stat-label">Awaiting you</div>
          <div className="pg-stat-value" style={{ color: 'var(--fg-warning)' }}>
            2
          </div>
          <div className="pg-stat-delta" style={{ color: 'var(--fg-secondary)' }}>
            1 urgent
          </div>
        </div>
        <div className="pg-stat-card">
          <div className="pg-stat-label">Approved · 7d</div>
          <div className="pg-stat-value">23</div>
          <div className="pg-stat-delta" style={{ color: 'var(--fg-secondary)' }}>
            avg time-to-approve 1h 47m
          </div>
        </div>
        <div className="pg-stat-card">
          <div className="pg-stat-label">Rejected · 7d</div>
          <div className="pg-stat-value">2</div>
          <div className="pg-stat-delta" style={{ color: 'var(--fg-secondary)' }}>
            all returned for changes
          </div>
        </div>
      </div>

      {/* Pending cards */}
      {PENDING.map((a) => (
        <div
          key={a.id}
          className="pg-card"
          style={{
            marginBottom: 12,
            borderColor: a.urgent ? 'var(--fg-warning)' : undefined,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className="pg-badge pg-badge-accent pg-mono">{a.id}</span>
              <span className="pg-badge pg-badge-default">{a.stage}</span>
              <span style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>{a.project}</span>
              {a.urgent && <span className="pg-badge pg-badge-warning">Urgent</span>}
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button className="pg-btn pg-btn-ghost pg-btn-sm">View details</button>
              <button className="pg-btn pg-btn-secondary pg-btn-sm">Reject</button>
              <button className="pg-btn pg-btn-primary pg-btn-sm">Approve</button>
            </div>
          </div>
          <div
            style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-primary)', marginBottom: 8 }}
          >
            {a.summary}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 11,
              color: 'var(--fg-tertiary)',
            }}
          >
            <span>Requested by {a.requester}</span>
            <span>·</span>
            <span>{a.requested}</span>
            <span>·</span>
            <span>
              Mode: <span className="pg-mono">{a.mode}</span> · {a.approved} of {a.total} approved
            </span>
          </div>
        </div>
      ))}

      {/* Recently approved table */}
      <div className="pg-card" style={{ marginTop: 16 }}>
        <div className="pg-card-header">
          <div className="pg-card-title">Recently approved · 7 days</div>
        </div>
        <div className="pg-table-wrap">
          <table className="pg-data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>What</th>
                <th>Project</th>
                <th>Approved by</th>
                <th>When</th>
                <th>TTA</th>
              </tr>
            </thead>
            <tbody>
              {APPROVED.map((row) => (
                <tr key={row.id}>
                  <td className="pg-mono" style={{ fontSize: 11 }}>
                    {row.id}
                  </td>
                  <td style={{ fontSize: 13 }}>{row.what}</td>
                  <td style={{ fontSize: 11, color: 'var(--fg-secondary)' }}>{row.project}</td>
                  <td style={{ fontSize: 11, color: 'var(--fg-secondary)' }}>{row.by}</td>
                  <td style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}>{row.when}</td>
                  <td className="pg-tabular" style={{ fontSize: 11 }}>
                    {row.tta}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
