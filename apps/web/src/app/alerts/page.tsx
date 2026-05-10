'use client';

import { Button } from '@/components/ui/button';

const FIRING = [
  {
    id: 'ALERT-247',
    severity: 'high',
    title: 'Error rate above threshold',
    desc: 'Error rate has been > 1% for 5 minutes',
    when: '47 min ago',
    metric: 'Error rate Â· /functions/v1/syncCalendarEvent',
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
    channels: 'Email Â· Slack #ops-alerts, PagerDuty',
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
    channels: 'Email Â· Slack',
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
    resolved: 'â€”',
    ttr: 'â€”',
  },
  {
    when: '12 min ago',
    alert: 'DB pool nearly full',
    severity: 'medium',
    status: 'firing',
    resolved: 'â€”',
    ttr: 'â€”',
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
    <div className="mx-auto max-w-[1440px] p-6" style={{ maxWidth: 1280 }}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Alerts</h1>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            2 currently firing Â· 9 rules configured Â· 17 alerts in last 30 days
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" type="button">
            Notification channels
          </Button>
          <Button variant="outline" size="sm" type="button">
            History
          </Button>
          <Button size="sm" type="button">
            + New rule
          </Button>
        </div>
      </div>

      {/* Currently firing */}
      <div
        className="rounded-md border bg-card text-card-foreground p-4"
        style={{
          marginBottom: 16,
          background: 'oklch(0.96 0.04 25)',
          borderColor: 'var(--destructive)',
        }}
      >
        <div className="mb-3 flex items-center justify-between border-b pb-3">
          <div className="text-sm font-semibold">Currently firing</div>
        </div>
        {FIRING.map((alert) => (
          <div key={alert.id} style={{ padding: '12px 0' }}>
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
                  className={`inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground ${alert.isCritical ? 'inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive' : 'inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}
                >
                  {alert.severity.toUpperCase()}
                </span>
                <span className="font-mono text-sm" style={{ fontSize: 11 }}>
                  {alert.id}
                </span>
                <span style={{ fontWeight: 500, fontSize: 13 }}>{alert.title}</span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <Button variant="ghost" size="sm" type="button">
                  Acknowledge
                </Button>
                <Button variant="outline" size="sm" type="button">
                  Silence 1h
                </Button>
                <Button size="sm" type="button">
                  View metric
                </Button>
              </div>
            </div>
            <div style={{ fontSize: 13, marginBottom: 4 }}>{alert.desc}</div>
            <div style={{ fontSize: 11 }}>
              Firing since {alert.when} Â· Metric:{' '}
              <span className="font-mono text-sm">{alert.metric}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Alert rules table */}
      <div
        className="rounded-md border bg-card text-card-foreground p-4"
        style={{ marginBottom: 16 }}
      >
        <div className="mb-3 flex items-center justify-between border-b pb-3">
          <div className="text-sm font-semibold">Alert rules</div>
        </div>
        <div className="overflow-hidden rounded-md border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th>Rule</th>
                <th>Type</th>
                <th className="tabular-nums">Threshold</th>
                <th>Channels</th>
                <th>Status</th>
                <th className="tabular-nums">Triggered Â· 30d</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {RULES.map((rule) => (
                <tr key={rule.name}>
                  <td style={{ fontWeight: 500, fontSize: 13 }}>{rule.name}</td>
                  <td style={{ fontSize: 11 }}>{rule.type}</td>
                  <td className="tabular-nums font-mono text-sm" style={{ fontSize: 11 }}>
                    {rule.threshold}
                  </td>
                  <td style={{ fontSize: 11 }}>{rule.channels}</td>
                  <td>
                    {rule.enabled ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        Enabled
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        Off
                      </span>
                    )}
                  </td>
                  <td
                    className="tabular-nums"
                    style={{ color: rule.triggered > 5 ? 'oklch(0.45 0.14 75)' : undefined }}
                  >
                    {rule.triggered}
                  </td>
                  <td>
                    <Button className="" variant="ghost" type="button">
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notification channels */}
      <div
        className="rounded-md border bg-card text-card-foreground p-4"
        style={{ marginBottom: 16 }}
      >
        <div className="mb-3 flex items-center justify-between border-b pb-3">
          <div className="text-sm font-semibold">Notification channels</div>
        </div>
        <div className="grid grid-cols-3 gap-4" style={{ padding: '0 0 4px' }}>
          <div>
            <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>Slack</div>
            <div style={{ fontSize: 11, marginBottom: 6 }}>#ops-alerts Â· #sec-alerts</div>
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              Connected
            </span>
          </div>
          <div>
            <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>Email</div>
            <div style={{ fontSize: 11, marginBottom: 6 }}>ops@acme.com Â· oncall@acme.com</div>
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              Connected
            </span>
          </div>
          <div>
            <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>PagerDuty</div>
            <div style={{ fontSize: 11, marginBottom: 6 }}>Service: platform-prod</div>
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              Connected
            </span>
          </div>
        </div>
      </div>

      {/* Recent alerts */}
      <div className="rounded-md border bg-card text-card-foreground p-4">
        <div className="mb-3 flex items-center justify-between border-b pb-3">
          <div className="text-sm font-semibold">Recent alerts Â· last 7 days</div>
        </div>
        <div className="overflow-hidden rounded-md border">
          <table className="w-full border-collapse text-sm">
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
                  <td style={{ fontSize: 11 }}>{row.when}</td>
                  <td style={{ fontSize: 13 }}>{row.alert}</td>
                  <td>
                    <span
                      className={`inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground ${row.severity === 'high' ? 'inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive' : 'inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}
                    >
                      {row.severity === 'high' ? 'High' : 'Med'}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground ${row.status === 'firing' ? 'inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}
                    >
                      {row.status === 'firing' ? 'Firing' : 'Resolved'}
                    </span>
                  </td>
                  <td style={{ fontSize: 11 }}>{row.resolved}</td>
                  <td className="tabular-nums" style={{ fontSize: 11 }}>
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
