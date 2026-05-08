interface DbWebhook {
  name: string;
  table: string;
  event: string;
  url: string;
  status: 'active' | 'paused';
  lastFired: string;
}

const WEBHOOKS: DbWebhook[] = [
  {
    name: 'on_deal_stage_change',
    table: 'deals',
    event: 'UPDATE',
    url: 'https://hooks.acme.local/deal-stage',
    status: 'active',
    lastFired: '2 min ago',
  },
  {
    name: 'on_contact_created',
    table: 'contacts',
    event: 'INSERT',
    url: 'https://hooks.acme.local/contact-new',
    status: 'active',
    lastFired: '15 min ago',
  },
  {
    name: 'on_deal_won',
    table: 'deals',
    event: "UPDATE WHERE stage='won'",
    url: 'https://hooks.acme.local/deal-won',
    status: 'active',
    lastFired: '47 min ago',
  },
  {
    name: 'on_invoice_paid',
    table: 'invoices',
    event: 'INSERT, UPDATE',
    url: 'https://hooks.acme.local/invoice',
    status: 'paused',
    lastFired: '3 days ago',
  },
];

export default function WebhooksPage() {
  return (
    <div style={{ padding: '16px 24px' }}>
      <div className="pg-page-header">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg-primary)', margin: 0 }}>
            Database Webhooks
          </h1>
          <div style={{ fontSize: 13, color: 'var(--fg-secondary)', marginTop: 4 }}>
            HTTP requests on database events
          </div>
        </div>
        <div className="pg-page-header-actions">
          <button className="pg-btn pg-btn-primary pg-btn-sm" type="button">
            + New webhook
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
              <th>Endpoint</th>
              <th>Status</th>
              <th>Last fired</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {WEBHOOKS.map((hook) => (
              <tr key={hook.name}>
                <td style={{ fontSize: 13 }}>{hook.name}</td>
                <td>
                  <span className="pg-mono" style={{ fontSize: 11, color: 'var(--fg-secondary)' }}>
                    {hook.table}
                  </span>
                </td>
                <td>
                  <span className="pg-badge pg-badge-default">{hook.event}</span>
                </td>
                <td>
                  <span
                    className="pg-mono"
                    style={{
                      fontSize: 11,
                      color: 'var(--fg-tertiary)',
                      display: 'block',
                      maxWidth: 220,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={hook.url}
                  >
                    {hook.url}
                  </span>
                </td>
                <td>
                  {hook.status === 'active' ? (
                    <span className="pg-badge pg-badge-success">active</span>
                  ) : (
                    <span className="pg-badge pg-badge-warning">paused</span>
                  )}
                </td>
                <td style={{ fontSize: 12, color: 'var(--fg-tertiary)' }}>{hook.lastFired}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="pg-btn pg-btn-ghost pg-btn-xs" type="button">
                      Edit
                    </button>
                    <button
                      className="pg-btn pg-btn-ghost pg-btn-xs"
                      type="button"
                      style={{ color: 'var(--fg-danger)' }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
