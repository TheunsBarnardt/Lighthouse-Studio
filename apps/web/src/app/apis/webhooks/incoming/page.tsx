interface IncomingEndpoint {
  id: string;
  source: string;
  url: string;
  triggers: string;
  events30d: number;
  status: 'live';
}

const ENDPOINTS: IncomingEndpoint[] = [
  {
    id: 'ihook_241a',
    source: 'Stripe payments',
    url: 'https://api.acme.platform.local/webhooks/in/ihook_241a',
    triggers: 'invokes processStripeEvent',
    events30d: 12,
    status: 'live',
  },
  {
    id: 'ihook_142b',
    source: 'Outlook calendar push',
    url: 'https://api.acme.platform.local/webhooks/in/ihook_142b',
    triggers: 'invokes syncCalendarEvent',
    events30d: 47,
    status: 'live',
  },
  {
    id: 'ihook_8e23c',
    source: 'GitHub deploy notifications',
    url: 'https://api.acme.platform.local/webhooks/in/ihook_8e23c',
    triggers: 'invokes recordDeployment',
    events30d: 4,
    status: 'live',
  },
];

interface RecentEvent {
  when: string;
  source: string;
  eventType: string;
  fn: string;
  status: 'success' | 'error';
  latency: string;
}

const RECENT_EVENTS: RecentEvent[] = [
  {
    when: '3 min ago',
    source: 'Outlook',
    eventType: 'calendar.event.created',
    fn: 'syncCalendarEvent',
    status: 'success',
    latency: '87ms',
  },
  {
    when: '14 min ago',
    source: 'Stripe',
    eventType: 'payment_intent.succeeded',
    fn: 'processStripeEvent',
    status: 'success',
    latency: '142ms',
  },
  {
    when: '47 min ago',
    source: 'Outlook',
    eventType: 'calendar.event.updated',
    fn: 'syncCalendarEvent',
    status: 'success',
    latency: '94ms',
  },
  {
    when: '2h ago',
    source: 'GitHub',
    eventType: 'deployment_status',
    fn: 'recordDeployment',
    status: 'success',
    latency: '42ms',
  },
];

const SECRETS = [
  { source: 'Stripe', secret: 'whsec_•••a3f2' },
  { source: 'Outlook', secret: 'whsec_•••8e14' },
  { source: 'GitHub', secret: 'whsec_•••b821' },
];

export default function IncomingWebhooksPage() {
  return (
    <div className="pg-page" style={{ maxWidth: 1280 }}>
      <div className="pg-page-header">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--fg-primary)', margin: 0 }}>
            Webhooks · Incoming
          </h1>
          <div style={{ fontSize: 13, color: 'var(--fg-secondary)', marginTop: 4 }}>
            Receive events from external systems · 3 endpoints · 63 events / day average
          </div>
        </div>
        <div className="pg-page-header-actions">
          <button className="pg-btn pg-btn-secondary pg-btn-sm">Audit log</button>
          <button className="pg-btn pg-btn-primary pg-btn-sm">+ New endpoint</button>
        </div>
      </div>

      <div className="pg-grid pg-grid-4" style={{ marginBottom: 16 }}>
        <div className="pg-stat-card">
          <div className="pg-stat-label">Endpoints</div>
          <div className="pg-stat-value">3</div>
          <div className="pg-stat-delta" style={{ color: 'var(--fg-secondary)' }}>
            all live
          </div>
        </div>
        <div className="pg-stat-card">
          <div className="pg-stat-label">Events · 30d</div>
          <div className="pg-stat-value">1,892</div>
          <div className="pg-stat-delta pg-stat-up">+8% vs prior</div>
        </div>
        <div className="pg-stat-card">
          <div className="pg-stat-label">Verification failures</div>
          <div className="pg-stat-value" style={{ color: 'var(--fg-success)' }}>
            0
          </div>
          <div className="pg-stat-delta" style={{ color: 'var(--fg-secondary)' }}>
            all signatures valid
          </div>
        </div>
        <div className="pg-stat-card">
          <div className="pg-stat-label">Function errors</div>
          <div className="pg-stat-value">2</div>
          <div className="pg-stat-delta" style={{ color: 'var(--fg-secondary)' }}>
            last 30 days
          </div>
        </div>
      </div>

      <div className="pg-card" style={{ marginBottom: 16 }}>
        <div className="pg-card-header">
          <div className="pg-card-title">Configured endpoints</div>
        </div>
        <div className="pg-table-wrap">
          <table className="pg-data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Source</th>
                <th>URL</th>
                <th>Triggers</th>
                <th className="pg-tabular">Events · 30d</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ENDPOINTS.map((ep) => (
                <tr key={ep.id}>
                  <td className="pg-mono" style={{ fontSize: 12 }}>
                    {ep.id}
                  </td>
                  <td style={{ fontWeight: 500, fontSize: 13 }}>{ep.source}</td>
                  <td
                    className="pg-mono"
                    style={{
                      fontSize: 12,
                      color: 'var(--fg-secondary)',
                      maxWidth: 320,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {ep.url}
                  </td>
                  <td className="pg-mono" style={{ fontSize: 12 }}>
                    {ep.triggers}
                  </td>
                  <td className="pg-tabular">{ep.events30d}</td>
                  <td>
                    <span className="pg-badge pg-badge-success">Live</span>
                  </td>
                  <td style={{ display: 'flex', gap: 4 }}>
                    <button className="pg-btn pg-btn-ghost pg-btn-xs">Logs</button>
                    <button className="pg-btn pg-btn-ghost pg-btn-xs">Settings</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="pg-card" style={{ marginBottom: 16 }}>
        <div className="pg-card-header">
          <div className="pg-card-title">Verification</div>
        </div>
        <div className="pg-grid pg-grid-2">
          <div>
            <div style={{ fontWeight: 500, marginBottom: 8, color: 'var(--fg-primary)' }}>
              Signature requirements
            </div>
            <div style={{ fontSize: 13, color: 'var(--fg-secondary)', marginBottom: 8 }}>
              Each endpoint requires the source to sign the request body. Unsigned or invalid
              requests are rejected with 401.
            </div>
            <pre
              style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: 11,
                background: 'var(--bg-canvas)',
                border: '1px solid var(--border-default)',
                borderRadius: 4,
                padding: '6px 10px',
                color: 'var(--fg-primary)',
                margin: 0,
              }}
            >
              X-Platform-Signature: t=1714627847,v1=5257a869e7...
            </pre>
          </div>
          <div>
            <div style={{ fontWeight: 500, marginBottom: 8, color: 'var(--fg-primary)' }}>
              Per-source secrets
            </div>
            {SECRETS.map((s) => (
              <div key={s.source} className="pg-inspector-row">
                <span className="pg-inspector-key">{s.source}</span>
                <span className="pg-inspector-val pg-mono">{s.secret}</span>
              </div>
            ))}
            <div style={{ fontSize: 12, color: 'var(--fg-tertiary)', marginTop: 8 }}>
              Rotate secrets every 90 days.
            </div>
          </div>
        </div>
      </div>

      <div className="pg-card">
        <div className="pg-card-header">
          <div className="pg-card-title">Recent events</div>
        </div>
        <div className="pg-table-wrap">
          <table className="pg-data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Source</th>
                <th>Event type</th>
                <th>Triggered function</th>
                <th>Status</th>
                <th className="pg-tabular">Latency</th>
              </tr>
            </thead>
            <tbody>
              {RECENT_EVENTS.map((ev, i) => (
                <tr key={i}>
                  <td style={{ fontSize: 12, color: 'var(--fg-tertiary)' }}>{ev.when}</td>
                  <td style={{ fontSize: 13 }}>{ev.source}</td>
                  <td className="pg-mono" style={{ fontSize: 12 }}>
                    {ev.eventType}
                  </td>
                  <td className="pg-mono" style={{ fontSize: 12 }}>
                    {ev.fn}
                  </td>
                  <td>
                    {ev.status === 'success' ? (
                      <span className="pg-badge pg-badge-success">Success</span>
                    ) : (
                      <span className="pg-badge pg-badge-danger">Error</span>
                    )}
                  </td>
                  <td className="pg-tabular" style={{ fontSize: 12 }}>
                    {ev.latency}
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
