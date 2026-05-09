'use client';

import { Button } from '@/components/ui/button';

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
    <div className="mx-auto max-w-[1440px] p-6" style={{ maxWidth: 1280 }}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Uptime / Status</h1>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            All systems operational · Last incident 3 days ago · Public status:
            status.acme.platform.local
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" type="button">
            Public status page
          </Button>
          <Button variant="outline" size="sm" type="button">
            Incident history
          </Button>
          <Button size="sm" type="button">
            + Incident
          </Button>
        </div>
      </div>

      {/* All systems green banner */}
      <div
        className="rounded-md border bg-card text-card-foreground p-4"
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
              <div style={{ fontWeight: 600 }}>All systems operational</div>
              <div style={{ fontSize: 13 }}>
                8 of 8 services responding normally · last check 30 seconds ago
              </div>
            </div>
          </div>
          <div className="tabular-nums" style={{ fontSize: 24, fontWeight: 700 }}>
            99.97%
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4" style={{ marginBottom: 16 }}>
        <div className="rounded-md border bg-card p-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            90-day uptime
          </div>
          <div className="text-[22px] font-semibold tabular-nums">99.97%</div>
          <div className="mt-1 text-[11px] text-muted-foreground">SLA: 99.9%</div>
        </div>
        <div className="rounded-md border bg-card p-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            30-day uptime
          </div>
          <div className="text-[22px] font-semibold tabular-nums">99.99%</div>
          <div className="mt-1 text-[11px] text-muted-foreground">no incidents</div>
        </div>
        <div className="rounded-md border bg-card p-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            Total downtime · 90d
          </div>
          <div className="text-[22px] font-semibold tabular-nums">37m</div>
          <div className="mt-1 text-[11px] text-muted-foreground">3 incidents</div>
        </div>
        <div className="rounded-md border bg-card p-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            MTTR
          </div>
          <div className="text-[22px] font-semibold tabular-nums">12m</div>
          <div className="mt-1 text-[11px] text-muted-foreground text-emerald-600">
            −4m vs prior
          </div>
        </div>
      </div>

      {/* Service status bars */}
      <div
        className="rounded-md border bg-card text-card-foreground p-4"
        style={{ marginBottom: 16 }}
      >
        <div
          className="mb-3 flex items-center justify-between border-b pb-3"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <div className="text-sm font-semibold">Service status · last 90 days</div>
          <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
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
              <span style={{ fontWeight: 500, fontSize: 13 }}>{svc.name}</span>
              <span className="tabular-nums" style={{ fontSize: 13, fontWeight: 600 }}>
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
            marginTop: 8,
          }}
        >
          <span>90 days ago</span>
          <span>Today</span>
        </div>
      </div>

      {/* Incident history */}
      <div className="rounded-md border bg-card text-card-foreground p-4">
        <div className="mb-3 flex items-center justify-between border-b pb-3">
          <div className="text-sm font-semibold">Incident history</div>
        </div>
        <div className="overflow-hidden rounded-md border">
          <table className="w-full border-collapse text-sm">
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
                  <td style={{ fontSize: 11 }}>{inc.when}</td>
                  <td style={{ fontSize: 13 }}>{inc.service}</td>
                  <td>
                    <span
                      className={`inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground ${inc.type === 'outage' ? 'inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive' : 'inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}
                    >
                      {inc.type === 'outage' ? 'Outage' : 'Degraded'}
                    </span>
                  </td>
                  <td className="tabular-nums" style={{ fontSize: 11 }}>
                    {inc.duration}
                  </td>
                  <td style={{ fontSize: 13 }}>{inc.impact}</td>
                  <td style={{ fontSize: 11 }}>{inc.resolution}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
