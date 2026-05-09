import { Button } from '@/components/ui/button';

const TRIGGERS = [
  {
    name: 'on_user_created',
    table: 'auth.users',
    event: 'AFTER INSERT',
    fn: 'handle_new_user',
    activation: 'For each row',
  },
  {
    name: 'on_deal_stage_changed',
    table: 'public.deals',
    event: 'AFTER UPDATE OF stage',
    fn: 'notify_stage_change',
    activation: 'For each row',
  },
  {
    name: 'on_deal_won',
    table: 'public.deals',
    event: 'AFTER UPDATE',
    fn: 'notify_deal_won',
    activation: 'For each row',
  },
  {
    name: 'enforce_workspace_scope',
    table: 'public.contacts',
    event: 'BEFORE INSERT, UPDATE',
    fn: 'check_workspace',
    activation: 'For each row',
  },
  {
    name: 'audit_changes',
    table: 'public.deals',
    event: 'AFTER INSERT, UPDATE, DELETE',
    fn: 'log_audit_event',
    activation: 'For each row',
  },
];

export default function DatabaseTriggersPage() {
  return (
    <div style={{ padding: '16px 24px' }}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Triggers</h1>
          <div style={{ fontSize: 13, marginTop: 4 }}>{TRIGGERS.length} triggers</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" type="button">
            + New trigger
          </Button>
        </div>
      </div>
      <div className="overflow-hidden rounded-md border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th>Name</th>
              <th>Table</th>
              <th>Event</th>
              <th>Function</th>
              <th>Activation</th>
            </tr>
          </thead>
          <tbody>
            {TRIGGERS.map((t) => (
              <tr key={t.name}>
                <td>
                  <span className="font-mono text-sm" style={{ fontSize: 11 }}>
                    {t.name}
                  </span>
                </td>
                <td>
                  <span className="font-mono text-sm" style={{ fontSize: 11 }}>
                    {t.table}
                  </span>
                </td>
                <td style={{ fontSize: 12 }}>{t.event}</td>
                <td>
                  <span className="font-mono text-sm" style={{ fontSize: 11 }}>
                    {t.fn}
                  </span>
                </td>
                <td style={{ fontSize: 12 }}>{t.activation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
