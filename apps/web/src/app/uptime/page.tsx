'use client';

const SERVICES = [
  { name: 'API · REST', uptime: '99.97%', outages: [3] },
  { name: 'API · GraphQL', uptime: '99.99%', outages: [] },
  { name: 'Database · primary', uptime: '100%', outages: [] },
  { name: 'Database · read replica', uptime: '99.92%', outages: [12, 47] },
  { name: 'Edge functions', uptime: '99.94%', outages: [22] },
  { name: 'Storage', uptime: '100%', outages: [] },
  { name: 'Realtime', uptime: '99.98%', outages: [3] },
  { name: 'Auth', uptime: '100%', outages: [] },
];

const INCIDENTS = [
  {
    when: '3 days ago',
    service: 'API · REST',
    type: 'degraded',
    duration: '14m',
    impact: 'Elevated latency on /functions/v1/*',
    resolution: 'Edge function pool restart',
  },
  {
    when: '14 days ago',
    service: 'DB · read replica',
    type: 'degraded',
    duration: '8m',
    impact: 'Replica lag spike',
    resolution: 'Auto-failover succeeded',
  },
  {
    when: '22 days ago',
    service: 'Edge functions',
    type: 'outage',
    duration: '4m',
    impact: 'All edge function invocations failed',
    resolution: 'Bad deploy rolled back',
  },
  {
    when: '47 days ago',
    service: 'DB · read replica',
    type: 'degraded',
    duration: '11m',
    impact: 'High connection pool usage',
    resolution: 'Pool size increased',
  },
];

function UptimeBar({ outages }: { outages: number[] }) {
  const days = 90;
  return (
    <div style={{ display: 'flex', gap: 1, height: 28 }}>
      {Array.from({ length: days }, (_, i) => {
        const idx = days - 1 - i;
        const isOutage = outages.includes(idx);
        const isDegraded = idx === 14 || idx === 47;
        return (
          <div
            key={i}
            title={`Day -${String(idx)}`}
            style={{
              flex: 1,
              minWidth: 2,
              borderRadius: 1,
              background: isOutage
                ? 'var(--fg-danger)'
                : isDegraded
                  ? 'var(--fg-warning)'
                  : 'var(--fg-success)',
              cursor: 'pointer',
            }}
          />
        );
      })}
    </div>
  );
}

export default function UptimePage() {
  return (
    <div className="pg-page" style={{ maxWidth: 1280 }}>
      <div className="pg-page-header">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--fg-primary)', margin: 0 }}>
            Uptime / Status
          </h1>
          <div style={{ fontSize: 13, color: 'var(--fg-secondary)', marginTop: 4 }}>
            All systems operational · Last incident 3 days ago · Public status:
            status.acme.platform.local
          </div>
        </div>
        <div className="pg-page-header-actions">
          <button className="pg-btn pg-btn-secondary pg-btn-sm">Public status page</button>
          <button className="pg-btn pg-btn-secondary pg-btn-sm">Incident history</button>
          <button className="pg-btn pg-btn-primary pg-btn-sm">+ Incident</button>
        </div>
      </div>

      {/* All systems green banner */}
      <div
        className="pg-card"
        style={{
          marginBottom: 16,
          background: 'var(--bg-success-subtle)',
          borderColor: 'var(--fg-success)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 12,
                height: 12,
                background: 'var(--fg-success)',
                borderRadius: '50%',
                flexShrink: 0,
              }}
            />
            <div>
              <div style={{ fontWeight: 600, color: 'var(--fg-primary)' }}>
                All systems operational
              </div>
              <div style={{ fontSize: 13, color: 'var(--fg-secondary)' }}>
                8 of 8 services responding normally · last check 30 seconds ago
              </div>
            </div>
          </div>
          <div
            className="pg-tabular"
            style={{ fontSize: 24, fontWeight: 700, color: 'var(--fg-success)' }}
          >
            99.97%
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="pg-grid pg-grid-4" style={{ marginBottom: 16 }}>
        <div className="pg-stat-card">
          <div className="pg-stat-label">90-day uptime</div>
          <div className="pg-stat-value" style={{ color: 'var(--fg-success)' }}>
            99.97%
          </div>
          <div className="pg-stat-delta" style={{ color: 'var(--fg-secondary)' }}>
            SLA: 99.9%
          </div>
        </div>
        <div className="pg-stat-card">
          <div className="pg-stat-label">30-day uptime</div>
          <div className="pg-stat-value" style={{ color: 'var(--fg-success)' }}>
            99.99%
          </div>
          <div className="pg-stat-delta" style={{ color: 'var(--fg-secondary)' }}>
            no incidents
          </div>
        </div>
        <div className="pg-stat-card">
          <div className="pg-stat-label">Total downtime · 90d</div>
          <div className="pg-stat-value">37m</div>
          <div className="pg-stat-delta" style={{ color: 'var(--fg-secondary)' }}>
            3 incidents
          </div>
        </div>
        <div className="pg-stat-card">
          <div className="pg-stat-label">MTTR</div>
          <div className="pg-stat-value">12m</div>
          <div className="pg-stat-delta pg-stat-up">−4m vs prior</div>
        </div>
      </div>

      {/* Service status bars */}
      <div className="pg-card" style={{ marginBottom: 16 }}>
        <div
          className="pg-card-header"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <div className="pg-card-title">Service status · last 90 days</div>
          <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--fg-tertiary)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  background: 'var(--fg-success)',
                  borderRadius: 1,
                  display: 'inline-block',
                }}
              />
              Up
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  background: 'var(--fg-warning)',
                  borderRadius: 1,
                  display: 'inline-block',
                }}
              />
              Degraded
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  background: 'var(--fg-danger)',
                  borderRadius: 1,
                  display: 'inline-block',
                }}
              />
              Down
            </span>
          </div>
        </div>
        {SERVICES.map((svc) => (
          <div key={svc.name} style={{ marginBottom: 16 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 6,
              }}
            >
              <span style={{ fontWeight: 500, fontSize: 13, color: 'var(--fg-primary)' }}>
                {svc.name}
              </span>
              <span
                className="pg-tabular"
                style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-success)' }}
              >
                {svc.uptime}
              </span>
            </div>
            <UptimeBar outages={svc.outages} />
          </div>
        ))}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11,
            color: 'var(--fg-tertiary)',
            marginTop: 8,
          }}
        >
          <span>90 days ago</span>
          <span>Today</span>
        </div>
      </div>

      {/* Incident history */}
      <div className="pg-card">
        <div className="pg-card-header">
          <div className="pg-card-title">Incident history</div>
        </div>
        <div className="pg-table-wrap">
          <table className="pg-data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Service</th>
                <th>Type</th>
                <th>Duration</th>
                <th>Impact</th>
                <th>Resolution</th>
              </tr>
            </thead>
            <tbody>
              {INCIDENTS.map((inc, i) => (
                <tr key={i}>
                  <td style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}>{inc.when}</td>
                  <td style={{ fontSize: 13 }}>{inc.service}</td>
                  <td>
                    <span
                      className={`pg-badge ${inc.type === 'outage' ? 'pg-badge-danger' : 'pg-badge-warning'}`}
                    >
                      {inc.type === 'outage' ? 'Outage' : 'Degraded'}
                    </span>
                  </td>
                  <td className="pg-tabular" style={{ fontSize: 11 }}>
                    {inc.duration}
                  </td>
                  <td style={{ fontSize: 13 }}>{inc.impact}</td>
                  <td style={{ fontSize: 11, color: 'var(--fg-secondary)' }}>{inc.resolution}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
