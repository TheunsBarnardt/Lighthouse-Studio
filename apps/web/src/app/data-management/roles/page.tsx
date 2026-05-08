const ROLES = [
  {
    name: 'postgres',
    login: '✓',
    memberOf: 'pg_read_all_data, pg_write_all_data',
    inherits: '✓',
    description: 'Superuser; reserved for admin tools',
  },
  {
    name: 'authenticated',
    login: '—',
    memberOf: '—',
    inherits: '✓',
    description: 'Standard role for signed-in users',
  },
  {
    name: 'anon',
    login: '—',
    memberOf: '—',
    inherits: '✓',
    description: 'Standard role for anonymous (unauthenticated) requests',
  },
  {
    name: 'service_role',
    login: '✓',
    memberOf: 'pg_read_all_data, pg_write_all_data',
    inherits: '✓',
    description: 'Bypass RLS; never expose client-side',
  },
  {
    name: 'platform_readonly',
    login: '—',
    memberOf: '—',
    inherits: '✓',
    description: 'Read-only for analytics tools',
  },
];

export default function DatabaseRolesPage() {
  return (
    <div style={{ padding: '16px 24px' }}>
      <div className="pg-page-header">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg-primary)', margin: 0 }}>
            Roles
          </h1>
          <div style={{ fontSize: 13, color: 'var(--fg-secondary)', marginTop: 4 }}>
            Database roles · used by API key scopes
          </div>
        </div>
        <div className="pg-page-header-actions">
          <button className="pg-btn pg-btn-primary pg-btn-sm" type="button">
            + New role
          </button>
        </div>
      </div>
      <div className="pg-table-wrap">
        <table className="pg-data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Login</th>
              <th>Member of</th>
              <th>Inherits</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {ROLES.map((r) => (
              <tr key={r.name}>
                <td>
                  <span className="pg-mono" style={{ fontSize: 12 }}>
                    {r.name}
                  </span>
                </td>
                <td style={{ color: 'var(--fg-tertiary)' }}>{r.login}</td>
                <td style={{ fontSize: 11, color: 'var(--fg-secondary)' }}>{r.memberOf}</td>
                <td style={{ color: 'var(--fg-tertiary)' }}>{r.inherits}</td>
                <td style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>{r.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
