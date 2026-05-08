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
      <div className="pg-page-header">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg-primary)', margin: 0 }}>
            Triggers
          </h1>
          <div style={{ fontSize: 13, color: 'var(--fg-secondary)', marginTop: 4 }}>
            {TRIGGERS.length} triggers
          </div>
        </div>
        <div className="pg-page-header-actions">
          <button className="pg-btn pg-btn-primary pg-btn-sm" type="button">
            + New trigger
          </button>
        </div>
      </div>
      <div className="pg-table-wrap">
        <table className="pg-data-table">
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
                  <span className="pg-mono" style={{ fontSize: 11 }}>
                    {t.name}
                  </span>
                </td>
                <td>
                  <span className="pg-mono" style={{ fontSize: 11, color: 'var(--fg-secondary)' }}>
                    {t.table}
                  </span>
                </td>
                <td style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>{t.event}</td>
                <td>
                  <span className="pg-mono" style={{ fontSize: 11 }}>
                    {t.fn}
                  </span>
                </td>
                <td style={{ fontSize: 12, color: 'var(--fg-tertiary)' }}>{t.activation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
