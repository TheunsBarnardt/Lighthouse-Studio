'use client';

const FIRING = [
  {
    id: 'ALERT-247',
    severity: 'high',
    title: 'Error rate above threshold',
    desc: 'Error rate has been > 1% for 5 minutes',
    when: '47 min ago',
    metric: 'Error rate · /functions/v1/syncCalendarEvent',
    isCritical: true,
  },
  {
    id: 'ALERT-246',
    severity: 'medium',
    title: 'Database connection pool nearly full',
    desc: 'Active connections: 22/25 for 3 minutes',
    when: '12 min ago',
    metric: 'db.connections.active',
    isCritical: false,
  },
];

const RULES = [
  {
    name: 'Error rate > 1%',
    type: 'p95 over 5 min',
    threshold: '1%',
    channels: 'Slack #ops-alerts, PagerDuty',
    enabled: true,
    triggered: 12,
  },
  {
    name: 'Latency p95 > 500ms',
    type: 'p95 over 5 min',
    threshold: '500ms',
    channels: 'Slack #ops-alerts',
    enabled: true,
    triggered: 4,
  },
  {
    name: 'DB connection pool > 80%',
    type: 'gauge',
    threshold: '80%',
    channels: 'Slack #ops-alerts',
    enabled: true,
    triggered: 1,
  },
  {
    name: 'Failed deploys',
    type: 'count over 1h',
    threshold: '1',
    channels: 'Email · Slack #ops-alerts, PagerDuty',
    enabled: true,
    triggered: 0,
  },
  {
    name: 'Disk usage > 85%',
    type: 'gauge',
    threshold: '85%',
    channels: 'Email',
    enabled: true,
    triggered: 0,
  },
  {
    name: 'CVE high severity detected',
    type: 'event',
    threshold: 'high+',
    channels: 'Email · Slack',
    enabled: true,
    triggered: 0,
  },
  {
    name: 'Approval pending > 24h',
    type: 'duration',
    threshold: '24h',
    channels: 'Email',
    enabled: true,
    triggered: 0,
  },
  {
    name: 'Suspicious auth failures',
    type: 'rate over 1h',
    threshold: '10/min',
    channels: 'PagerDuty',
    enabled: true,
    triggered: 0,
  },
  {
    name: 'SSL cert expires < 14d',
    type: 'days',
    threshold: '14d',
    channels: 'Email',
    enabled: true,
    triggered: 0,
  },
];

const HISTORY = [
  {
    when: '47 min ago',
    alert: 'Error rate above threshold',
    severity: 'high',
    status: 'firing',
    resolved: '—',
    ttr: '—',
  },
  {
    when: '12 min ago',
    alert: 'DB pool nearly full',
    severity: 'medium',
    status: 'firing',
    resolved: '—',
    ttr: '—',
  },
  {
    when: 'Yesterday',
    alert: 'Latency p95 > 500ms',
    severity: 'medium',
    status: 'resolved',
    resolved: 'Yesterday',
    ttr: '14m',
  },
  {
    when: '3 days ago',
    alert: 'Error rate above threshold',
    severity: 'high',
    status: 'resolved',
    resolved: '3 days ago',
    ttr: '42m',
  },
  {
    when: '5 days ago',
    alert: 'CVE high severity',
    severity: 'high',
    status: 'resolved',
    resolved: '5 days ago',
    ttr: '2h 14m',
  },
];

export default function AlertsPage() {
  return (
    <div className="pg-page" style={{ maxWidth: 1280 }}>
      <div className="pg-page-header">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--fg-primary)', margin: 0 }}>
            Alerts
          </h1>
          <div style={{ fontSize: 13, color: 'var(--fg-secondary)', marginTop: 4 }}>
            2 currently firing · 9 rules configured · 17 alerts in last 30 days
          </div>
        </div>
        <div className="pg-page-header-actions">
          <button className="pg-btn pg-btn-secondary pg-btn-sm">Notification channels</button>
          <button className="pg-btn pg-btn-secondary pg-btn-sm">History</button>
          <button className="pg-btn pg-btn-primary pg-btn-sm">+ New rule</button>
        </div>
      </div>

      {/* Currently firing */}
      <div
        className="pg-card"
        style={{
          marginBottom: 16,
          background: 'var(--bg-danger-subtle)',
          borderColor: 'var(--fg-danger)',
        }}
      >
        <div className="pg-card-header">
          <div className="pg-card-title">Currently firing</div>
        </div>
        {FIRING.map((alert) => (
          <div
            key={alert.id}
            style={{ padding: '12px 0', borderBottom: '1px solid var(--border-default)' }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  className={`pg-badge ${alert.isCritical ? 'pg-badge-danger' : 'pg-badge-warning'}`}
                >
                  {alert.severity.toUpperCase()}
                </span>
                <span className="pg-mono" style={{ fontSize: 11 }}>
                  {alert.id}
                </span>
                <span style={{ fontWeight: 500, fontSize: 13, color: 'var(--fg-primary)' }}>
                  {alert.title}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button className="pg-btn pg-btn-ghost pg-btn-sm">Acknowledge</button>
                <button className="pg-btn pg-btn-secondary pg-btn-sm">Silence 1h</button>
                <button className="pg-btn pg-btn-primary pg-btn-sm">View metric</button>
              </div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--fg-secondary)', marginBottom: 4 }}>
              {alert.desc}
            </div>
            <div style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}>
              Firing since {alert.when} · Metric: <span className="pg-mono">{alert.metric}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Alert rules table */}
      <div className="pg-card" style={{ marginBottom: 16 }}>
        <div className="pg-card-header">
          <div className="pg-card-title">Alert rules</div>
        </div>
        <div className="pg-table-wrap">
          <table className="pg-data-table">
            <thead>
              <tr>
                <th>Rule</th>
                <th>Type</th>
                <th className="pg-tabular">Threshold</th>
                <th>Channels</th>
                <th>Status</th>
                <th className="pg-tabular">Triggered · 30d</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {RULES.map((rule) => (
                <tr key={rule.name}>
                  <td style={{ fontWeight: 500, fontSize: 13 }}>{rule.name}</td>
                  <td style={{ fontSize: 11, color: 'var(--fg-secondary)' }}>{rule.type}</td>
                  <td className="pg-tabular pg-mono" style={{ fontSize: 11 }}>
                    {rule.threshold}
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--fg-secondary)' }}>{rule.channels}</td>
                  <td>
                    {rule.enabled ? (
                      <span className="pg-badge pg-badge-success">Enabled</span>
                    ) : (
                      <span className="pg-badge pg-badge-default">Off</span>
                    )}
                  </td>
                  <td
                    className="pg-tabular"
                    style={{ color: rule.triggered > 5 ? 'var(--fg-warning)' : undefined }}
                  >
                    {rule.triggered}
                  </td>
                  <td>
                    <button className="pg-btn pg-btn-ghost pg-btn-xs">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notification channels */}
      <div className="pg-card" style={{ marginBottom: 16 }}>
        <div className="pg-card-header">
          <div className="pg-card-title">Notification channels</div>
        </div>
        <div className="pg-grid pg-grid-3" style={{ padding: '0 0 4px' }}>
          <div>
            <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>Slack</div>
            <div style={{ fontSize: 11, color: 'var(--fg-secondary)', marginBottom: 6 }}>
              #ops-alerts · #sec-alerts
            </div>
            <span className="pg-badge pg-badge-success">Connected</span>
          </div>
          <div>
            <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>Email</div>
            <div style={{ fontSize: 11, color: 'var(--fg-secondary)', marginBottom: 6 }}>
              ops@acme.com · oncall@acme.com
            </div>
            <span className="pg-badge pg-badge-success">Connected</span>
          </div>
          <div>
            <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>PagerDuty</div>
            <div style={{ fontSize: 11, color: 'var(--fg-secondary)', marginBottom: 6 }}>
              Service: platform-prod
            </div>
            <span className="pg-badge pg-badge-success">Connected</span>
          </div>
        </div>
      </div>

      {/* Recent alerts */}
      <div className="pg-card">
        <div className="pg-card-header">
          <div className="pg-card-title">Recent alerts · last 7 days</div>
        </div>
        <div className="pg-table-wrap">
          <table className="pg-data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Alert</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Resolved</th>
                <th>TTR</th>
              </tr>
            </thead>
            <tbody>
              {HISTORY.map((row, i) => (
                <tr key={i}>
                  <td style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}>{row.when}</td>
                  <td style={{ fontSize: 13 }}>{row.alert}</td>
                  <td>
                    <span
                      className={`pg-badge ${row.severity === 'high' ? 'pg-badge-danger' : 'pg-badge-warning'}`}
                    >
                      {row.severity === 'high' ? 'High' : 'Med'}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`pg-badge ${row.status === 'firing' ? 'pg-badge-warning' : 'pg-badge-success'}`}
                    >
                      {row.status === 'firing' ? 'Firing' : 'Resolved'}
                    </span>
                  </td>
                  <td style={{ fontSize: 11 }}>{row.resolved}</td>
                  <td className="pg-tabular" style={{ fontSize: 11 }}>
                    {row.ttr}
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
