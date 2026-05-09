import { Button } from '@/components/ui/button';

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
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Roles</h1>
          <div style={{ fontSize: 13, marginTop: 4 }}>Database roles · used by API key scopes</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" type="button">
            + New role
          </Button>
        </div>
      </div>
      <div className="overflow-hidden rounded-md border">
        <table className="w-full border-collapse text-sm">
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
                  <span className="font-mono text-sm" style={{ fontSize: 12 }}>
                    {r.name}
                  </span>
                </td>
                <td>{r.login}</td>
                <td style={{ fontSize: 11 }}>{r.memberOf}</td>
                <td>{r.inherits}</td>
                <td style={{ fontSize: 12 }}>{r.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
