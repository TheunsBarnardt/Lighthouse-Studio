interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string;
  status: 'enabled' | 'paused' | 'failing';
  successRate: string;
  lastDelivery: string;
  total: number;
}

const WEBHOOKS: Webhook[] = [
  {
    id: 'hook_4d92e3',
    name: 'Slack notifications · #sales',
    url: 'https://hooks.slack.com/services/T0•••/B0•••',
    events: '3 events',
    status: 'enabled',
    successRate: '99.7%',
    lastDelivery: '12 min ago',
    total: 142,
  },
  {
    id: 'hook_8e147a',
    name: 'Salesforce sync',
    url: 'https://acme.my.salesforce.com/services/apexrest/platform/webhook',
    events: '5 events',
    status: 'enabled',
    successRate: '94.2%',
    lastDelivery: '47 min ago',
    total: 1247,
  },
  {
    id: 'hook_a3f291',
    name: 'Customer.io · audience updates',
    url: 'https://track.customer.io/api/v1/customers/{id}',
    events: '2 events',
    status: 'enabled',
    successRate: '99.9%',
    lastDelivery: '2h ago',
    total: 847,
  },
  {
    id: 'hook_b8214c',
    name: 'Internal accounting',
    url: 'https://accounting.acme.local/webhook',
    events: '1 event',
    status: 'paused',
    successRate: '—',
    lastDelivery: 'Yesterday',
    total: 12,
  },
  {
    id: 'hook_c9362d',
    name: 'Legacy CRM bridge',
    url: 'https://legacy-crm.acme.local/api/v1/sync',
    events: '4 events',
    status: 'failing',
    successRate: '12.4%',
    lastDelivery: '3 hours ago',
    total: 47,
  },
];

interface Delivery {
  when: string;
  hook: string;
  event: string;
  status: string;
  latency: string;
  attempts: string;
}

const DELIVERIES: Delivery[] = [
  {
    when: '12 min ago',
    hook: 'Slack notifications',
    event: 'deal.won',
    status: '200',
    latency: '142ms',
    attempts: '1',
  },
  {
    when: '28 min ago',
    hook: 'Salesforce sync',
    event: 'contact.updated',
    status: '200',
    latency: '847ms',
    attempts: '1',
  },
  {
    when: '47 min ago',
    hook: 'Salesforce sync',
    event: 'deal.created',
    status: '200',
    latency: '312ms',
    attempts: '1',
  },
  {
    when: '3h ago',
    hook: 'Legacy CRM bridge',
    event: 'deal.updated',
    status: '503',
    latency: '8.2s',
    attempts: '3 of 5',
  },
  {
    when: '3h ago',
    hook: 'Legacy CRM bridge',
    event: 'contact.created',
    status: '503',
    latency: '8.4s',
    attempts: '3 of 5',
  },
];

function webhookStatusBadge(status: Webhook['status']) {
  if (status === 'enabled') return <span className="pg-badge pg-badge-success">Enabled</span>;
  if (status === 'paused') return <span className="pg-badge pg-badge-warning">Paused</span>;
  return <span className="pg-badge pg-badge-danger">Failing</span>;
}

function httpStatusBadge(status: string) {
  return status.startsWith('2') ? (
    <span className="pg-badge pg-badge-success">{status}</span>
  ) : (
    <span className="pg-badge pg-badge-danger">{status}</span>
  );
}

export default function WebhooksPage() {
  return (
    <div className="pg-page" style={{ maxWidth: 1280 }}>
      <div className="pg-page-header">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--fg-primary)', margin: 0 }}>
            Webhooks · Outgoing
          </h1>
          <div style={{ fontSize: 13, color: 'var(--fg-secondary)', marginTop: 4 }}>
            Notify external systems on data changes · 5 hooks · 4 active · 1 paused
          </div>
        </div>
        <div className="pg-page-header-actions">
          <button className="pg-btn pg-btn-secondary pg-btn-sm">Templates</button>
          <button className="pg-btn pg-btn-secondary pg-btn-sm">Audit log</button>
          <button className="pg-btn pg-btn-primary pg-btn-sm">+ New webhook</button>
        </div>
      </div>

      <div className="pg-grid pg-grid-4" style={{ marginBottom: 16 }}>
        <div className="pg-stat-card">
          <div className="pg-stat-label">Active hooks</div>
          <div className="pg-stat-value">4</div>
          <div className="pg-stat-delta" style={{ color: 'var(--fg-secondary)' }}>
            1 paused
          </div>
        </div>
        <div className="pg-stat-card">
          <div className="pg-stat-label">Deliveries · 30d</div>
          <div className="pg-stat-value">2,295</div>
          <div className="pg-stat-delta pg-stat-up">+12% vs prior</div>
        </div>
        <div className="pg-stat-card">
          <div className="pg-stat-label">Success rate</div>
          <div className="pg-stat-value" style={{ color: 'var(--fg-warning)' }}>
            97.2%
          </div>
          <div className="pg-stat-delta" style={{ color: 'var(--fg-secondary)' }}>
            SLA: 99%
          </div>
        </div>
        <div className="pg-stat-card">
          <div className="pg-stat-label">Failing hooks</div>
          <div className="pg-stat-value" style={{ color: 'var(--fg-danger)' }}>
            1
          </div>
          <div className="pg-stat-delta" style={{ color: 'var(--fg-secondary)' }}>
            Legacy CRM bridge
          </div>
        </div>
      </div>

      <div
        className="pg-card"
        style={{
          background: 'var(--bg-danger-subtle)',
          borderColor: 'var(--fg-danger)',
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--fg-primary)' }}>
              Legacy CRM bridge is failing
            </div>
            <div style={{ fontSize: 13, color: 'var(--fg-secondary)' }}>
              12.4% success rate over the last 24 hours · 41 of 47 deliveries returned 503. Endpoint
              may be down.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 16 }}>
            <button className="pg-btn pg-btn-secondary pg-btn-sm">View deliveries</button>
            <button className="pg-btn pg-btn-secondary pg-btn-sm">Pause</button>
          </div>
        </div>
      </div>

      <div className="pg-card" style={{ marginBottom: 16 }}>
        <div className="pg-card-header">
          <div className="pg-card-title">Configured webhooks</div>
        </div>
        <div className="pg-table-wrap">
          <table className="pg-data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>URL</th>
                <th>Events</th>
                <th>Status</th>
                <th>Success · 24h</th>
                <th>Last delivery</th>
                <th className="pg-tabular">Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {WEBHOOKS.map((hook) => {
                const rateNum = parseFloat(hook.successRate);
                return (
                  <tr key={hook.id}>
                    <td className="pg-mono" style={{ fontSize: 12 }}>
                      {hook.id}
                    </td>
                    <td style={{ fontWeight: 500, fontSize: 13 }}>{hook.name}</td>
                    <td
                      className="pg-mono"
                      style={{
                        fontSize: 12,
                        color: 'var(--fg-secondary)',
                        maxWidth: 280,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {hook.url}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>{hook.events}</td>
                    <td>{webhookStatusBadge(hook.status)}</td>
                    <td
                      className="pg-tabular"
                      style={{
                        fontSize: 12,
                        color: !isNaN(rateNum) && rateNum < 90 ? 'var(--fg-danger)' : undefined,
                      }}
                    >
                      {hook.successRate}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--fg-tertiary)' }}>
                      {hook.lastDelivery}
                    </td>
                    <td className="pg-tabular">{hook.total}</td>
                    <td>
                      <button className="pg-btn pg-btn-ghost pg-btn-xs">Logs</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="pg-card" style={{ marginBottom: 16 }}>
        <div className="pg-card-header">
          <div className="pg-card-title">Recent deliveries</div>
          <div style={{ fontSize: 12, color: 'var(--fg-tertiary)' }}>
            Last 50 events · all hooks
          </div>
        </div>
        <div className="pg-table-wrap">
          <table className="pg-data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Hook</th>
                <th>Event</th>
                <th>Status</th>
                <th className="pg-tabular">Latency</th>
                <th>Attempts</th>
              </tr>
            </thead>
            <tbody>
              {DELIVERIES.map((row, i) => (
                <tr key={i}>
                  <td style={{ fontSize: 12, color: 'var(--fg-tertiary)' }}>{row.when}</td>
                  <td style={{ fontSize: 13 }}>{row.hook}</td>
                  <td className="pg-mono" style={{ fontSize: 12 }}>
                    {row.event}
                  </td>
                  <td>{httpStatusBadge(row.status)}</td>
                  <td className="pg-tabular" style={{ fontSize: 12 }}>
                    {row.latency}
                  </td>
                  <td style={{ fontSize: 12 }}>{row.attempts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="pg-card">
        <div className="pg-card-header">
          <div className="pg-card-title">Delivery guarantees</div>
        </div>
        <div className="pg-grid pg-grid-3">
          <div>
            <div style={{ fontWeight: 500, marginBottom: 4, color: 'var(--fg-primary)' }}>
              At-least-once delivery
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>
              Each event is retried with exponential backoff up to 5 times.
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 500, marginBottom: 4, color: 'var(--fg-primary)' }}>
              Signed payloads
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>
              All requests include an HMAC-SHA256 signature in the{' '}
              <span className="pg-mono">X-Platform-Signature</span> header.
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 500, marginBottom: 4, color: 'var(--fg-primary)' }}>
              Idempotency
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>
              Each delivery has a unique ID via the{' '}
              <span className="pg-mono">X-Platform-Event-Id</span> header.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
