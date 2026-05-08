const MIGRATIONS = [
  { version: '20260415_001', name: 'create_contacts_table', applied: '2026-04-15 09:14' },
  { version: '20260415_002', name: 'create_deals_table', applied: '2026-04-15 09:14' },
  { version: '20260418_001', name: 'add_company_index', applied: '2026-04-18 11:22' },
  { version: '20260420_001', name: 'create_activities_table', applied: '2026-04-20 14:08' },
  { version: '20260424_001', name: 'add_audit_log', applied: '2026-04-24 10:30' },
  { version: '20260428_001', name: 'add_deal_stage_enum', applied: '2026-04-28 16:45' },
  { version: '20260501_001', name: 'create_users_with_rls', applied: '2026-05-01 08:12' },
];

export default function MigrationsPage() {
  return (
    <div style={{ padding: '16px 24px' }}>
      <div className="pg-page-header">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg-primary)', margin: 0 }}>
            Migrations
          </h1>
          <div style={{ fontSize: 13, color: 'var(--fg-secondary)', marginTop: 4 }}>
            {MIGRATIONS.length} migrations applied · 0 pending
          </div>
        </div>
        <div className="pg-page-header-actions">
          <button className="pg-btn pg-btn-secondary pg-btn-sm" type="button">
            View pending
          </button>
          <button className="pg-btn pg-btn-primary pg-btn-sm" type="button">
            + New migration
          </button>
        </div>
      </div>
      <div className="pg-table-wrap">
        <table className="pg-data-table">
          <thead>
            <tr>
              <th>Version</th>
              <th>Name</th>
              <th>Status</th>
              <th>Applied</th>
            </tr>
          </thead>
          <tbody>
            {MIGRATIONS.map((m) => (
              <tr key={m.version}>
                <td>
                  <span className="pg-mono" style={{ fontSize: 11, color: 'var(--fg-secondary)' }}>
                    {m.version}
                  </span>
                </td>
                <td style={{ fontSize: 13 }}>{m.name}</td>
                <td>
                  <span className="pg-badge pg-badge-success">applied</span>
                </td>
                <td className="pg-tabular" style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}>
                  {m.applied}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
