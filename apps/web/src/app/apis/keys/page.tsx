interface ApiKey {
  name: string;
  token: string;
  scope: string;
  requests: string;
  lastUsed: string;
  createdBy: string;
  age: string;
  status: 'live' | 'test' | 'expired';
}

const KEYS: ApiKey[] = [
  {
    name: 'CRM Production · Read',
    token: 'pk_live_a1b2_•••',
    scope: 'service_role',
    requests: '142,847',
    lastUsed: '2 min ago',
    createdBy: 'Joana de Klerk',
    age: '14 days ago',
    status: 'live',
  },
  {
    name: 'CRM Production · Write',
    token: 'pk_live_3c4d_•••',
    scope: 'service_role',
    requests: '8,124',
    lastUsed: '12 min ago',
    createdBy: 'Joana de Klerk',
    age: '14 days ago',
    status: 'live',
  },
  {
    name: 'Mobile App',
    token: 'pk_live_5e6f_•••',
    scope: 'anon',
    requests: '47,321',
    lastUsed: '4 hours ago',
    createdBy: 'Tom Müller',
    age: '7 days ago',
    status: 'live',
  },
  {
    name: 'CI / Testing',
    token: 'pk_test_7g8h_•••',
    scope: 'service_role',
    requests: '1,247',
    lastUsed: 'Yesterday',
    createdBy: 'Marcus Acker',
    age: '2 days ago',
    status: 'test',
  },
  {
    name: 'Legacy import job',
    token: 'pk_test_9i0j_•••',
    scope: 'service_role',
    requests: '0',
    lastUsed: 'Never',
    createdBy: 'Tom Müller',
    age: '47 days ago',
    status: 'expired',
  },
];

interface RecentEvent {
  when: string;
  event: string;
  eventBadge: string;
  key: string;
  by: string;
  ip: string;
}

const RECENT_EVENTS: RecentEvent[] = [
  {
    when: '14 days ago',
    event: 'Created',
    eventBadge: 'success',
    key: 'CRM Production · Write',
    by: 'Joana de Klerk',
    ip: '102.65.x.x',
  },
  {
    when: '14 days ago',
    event: 'Rotated',
    eventBadge: 'warning',
    key: 'CRM Production · Write',
    by: 'Joana de Klerk',
    ip: '102.65.x.x',
  },
  {
    when: '2 days ago',
    event: 'Created',
    eventBadge: 'success',
    key: 'CI / Testing',
    by: 'Marcus Acker',
    ip: '102.65.x.x',
  },
  {
    when: '12 days ago',
    event: 'Expired',
    eventBadge: 'default',
    key: 'Legacy import job',
    by: 'system',
    ip: '—',
  },
];

function statusBadge(status: ApiKey['status']) {
  if (status === 'live') return <span className="pg-badge pg-badge-success">Live</span>;
  if (status === 'test') return <span className="pg-badge pg-badge-accent">Test</span>;
  return <span className="pg-badge pg-badge-default">Expired</span>;
}

function scopeBadge(scope: string) {
  if (scope === 'service_role')
    return <span className="pg-badge pg-badge-warning pg-mono">{scope}</span>;
  return <span className="pg-badge pg-badge-default pg-mono">{scope}</span>;
}

function eventBadge(event: string, variant: string) {
  const cls =
    variant === 'success'
      ? 'pg-badge pg-badge-success'
      : variant === 'warning'
        ? 'pg-badge pg-badge-warning'
        : 'pg-badge pg-badge-default';
  return <span className={cls}>{event}</span>;
}

const inlineCode = (text: string) => (
  <span
    className="pg-mono"
    style={{ background: 'var(--bg-surface)', padding: '1px 5px', borderRadius: 3, fontSize: 12 }}
  >
    {text}
  </span>
);

export default function ApiKeysPage() {
  return (
    <div className="pg-page" style={{ maxWidth: 1280 }}>
      <div className="pg-page-header">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--fg-primary)', margin: 0 }}>
            API Keys
          </h1>
          <div style={{ fontSize: 13, color: 'var(--fg-secondary)', marginTop: 4 }}>
            Issue, scope, and rotate API keys · 5 keys · 4 active · 1 expired
          </div>
        </div>
        <div className="pg-page-header-actions">
          <button className="pg-btn pg-btn-secondary pg-btn-sm">Audit log</button>
          <button className="pg-btn pg-btn-primary pg-btn-sm">+ New API key</button>
        </div>
      </div>

      <div
        className="pg-card"
        style={{
          background: 'var(--bg-warning-subtle)',
          borderColor: 'var(--fg-warning)',
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 13, color: 'var(--fg-primary)' }}>
          <strong>API keys grant access to your data.</strong> Keys with the{' '}
          {inlineCode('service_role')} scope bypass all RLS policies — use them only on trusted
          servers, never in client code. Use {inlineCode('anon')} for browser/mobile clients.
        </div>
      </div>

      <div className="pg-card" style={{ marginBottom: 16 }}>
        <div className="pg-card-header">
          <div className="pg-card-title">Active keys</div>
        </div>
        <div className="pg-table-wrap">
          <table className="pg-data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Token (masked)</th>
                <th>Scope</th>
                <th className="pg-tabular">Requests · 30d</th>
                <th>Last used</th>
                <th>Created by</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {KEYS.map((key) => (
                <tr key={key.token}>
                  <td style={{ fontWeight: 500 }}>{key.name}</td>
                  <td className="pg-mono" style={{ fontSize: 12 }}>
                    {key.token}
                  </td>
                  <td>{scopeBadge(key.scope)}</td>
                  <td className="pg-tabular">{key.requests}</td>
                  <td style={{ fontSize: 12, color: 'var(--fg-tertiary)' }}>{key.lastUsed}</td>
                  <td style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>
                    {key.createdBy} · {key.age}
                  </td>
                  <td>{statusBadge(key.status)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="pg-btn pg-btn-ghost pg-btn-xs">Rotate</button>
                      <button className="pg-btn pg-btn-ghost pg-btn-xs">Revoke</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="pg-card" style={{ marginBottom: 16 }}>
        <div className="pg-card-header">
          <div className="pg-card-title">Recommended rotation policy</div>
        </div>
        <div className="pg-grid pg-grid-3">
          <div className="pg-inspector-row">
            <span className="pg-inspector-key">Service role keys</span>
            <span className="pg-inspector-val">Rotate every 90 days</span>
          </div>
          <div className="pg-inspector-row">
            <span className="pg-inspector-key">Anon keys</span>
            <span className="pg-inspector-val">Rotate every 180 days</span>
          </div>
          <div className="pg-inspector-row">
            <span className="pg-inspector-key">Test keys</span>
            <span className="pg-inspector-val">No rotation enforced</span>
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--fg-tertiary)', marginTop: 12 }}>
          CRM Production · Write was rotated 14 days ago. Next reminder in 76 days.
        </div>
      </div>

      <div className="pg-card">
        <div className="pg-card-header">
          <div className="pg-card-title">Recent key events</div>
        </div>
        <div className="pg-table-wrap">
          <table className="pg-data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Event</th>
                <th>Key</th>
                <th>By</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {RECENT_EVENTS.map((ev, i) => (
                <tr key={i}>
                  <td style={{ fontSize: 12, color: 'var(--fg-tertiary)' }}>{ev.when}</td>
                  <td>{eventBadge(ev.event, ev.eventBadge)}</td>
                  <td className="pg-mono" style={{ fontSize: 12 }}>
                    {ev.key}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>{ev.by}</td>
                  <td className="pg-mono" style={{ fontSize: 12, color: 'var(--fg-tertiary)' }}>
                    {ev.ip}
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
