import { Button } from '@/components/ui/button';

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
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Migrations</h1>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            {MIGRATIONS.length} migrations applied · 0 pending
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" type="button">
            View pending
          </Button>
          <Button size="sm" type="button">
            + New migration
          </Button>
        </div>
      </div>
      <div className="overflow-hidden rounded-md border">
        <table className="w-full border-collapse text-sm">
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
                  <span className="font-mono text-sm" style={{ fontSize: 11 }}>
                    {m.version}
                  </span>
                </td>
                <td style={{ fontSize: 13 }}>{m.name}</td>
                <td>
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                    applied
                  </span>
                </td>
                <td className="tabular-nums" style={{ fontSize: 11 }}>
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
