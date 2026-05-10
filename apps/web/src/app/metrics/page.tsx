'use client';

import { Button } from '@/components/ui/button';

// Simple SVG sparkline chart â€” no external deps
function MetricChart({
  values,
  color,
  max: maxOverride,
}: {
  values: number[];
  color: string;
  max?: number;
}) {
  const W = 600;
  const H = 120;
  const max = maxOverride ?? Math.max(...values) * 1.1;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * W;
      const y = H - (v / max) * H;
      return `${String(x)},${String(y)}`;
    })
    .join(' ');
  const area = `0,${String(H)} ${points} ${String(W)},${String(H)}`;
  const gradId = `g${color.replace(/[^a-z0-9]/gi, '')}`;

  return (
    <div
      style={{
        height: 140,
        borderRadius: 4,
        padding: 8,
        position: 'relative',
      }}
    >
      <svg
        viewBox={`0 0 ${String(W)} ${String(H)}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: '100%' }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <line stroke="var(--border)" strokeWidth={0.5} x1={0} y1={0} x2={W} y2={0} />
        <line
          stroke="var(--border)"
          strokeWidth={0.5}
          x1={0}
          y1={H / 2}
          x2={W}
          y2={H / 2}
        />
        <line stroke="var(--border)" strokeWidth={0.5} x1={0} y1={H} x2={W} y2={H} />
        <polygon points={area} fill={`url(#${gradId})`} />
        <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} />
      </svg>
    </div>
  );
}

// Deterministic "random" data (no random() at render time to avoid hydration mismatch)
function wave(len: number, base: number, amp: number, freq: number): number[] {
  return Array.from({ length: len }, (_, i) => base + Math.sin(i / freq) * amp);
}

const requestsData = wave(60, 90, 20, 5);
const latencyData = wave(60, 190, 40, 7);
const errorData = wave(60, 0.25, 0.15, 6).map((v, i) => (i === 32 ? 3.2 : i === 47 ? 1.8 : v));
const cpuData = wave(60, 35, 12, 3);
const memData = wave(60, 62, 8, 8);
const dbConnData = wave(60, 17, 3, 4);

const TOP_ENDPOINTS = [
  { path: 'GET /rest/v1/deals', rps: '14.2', p50: '42ms', p95: '187ms', errors: '0' },
  { path: 'GET /rest/v1/contacts', rps: '8.7', p50: '38ms', p95: '142ms', errors: '0' },
  { path: 'POST /functions/v1/searchContacts', rps: '4.2', p50: '87ms', p95: '312ms', errors: '0' },
  { path: 'PATCH /rest/v1/deals/:id', rps: '2.1', p50: '28ms', p95: '94ms', errors: '0' },
];

export default function MetricsPage() {
  const lastReq = Math.round(requestsData[requestsData.length - 1]);
  const lastLat = Math.round(latencyData[latencyData.length - 1]);
  const lastDb = Math.round(dbConnData[dbConnData.length - 1]);

  return (
    <div className="mx-auto max-w-[1440px] p-6" style={{ maxWidth: 1400 }}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Metrics</h1>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            Time-series telemetry Â· OpenTelemetry Â· Last 60 minutes Â· Refresh in 30s
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <select
            style={{
              width: 140,
              height: 28,
              padding: '0 8px',
              borderRadius: 4,
              border: '1px solid var(--border)',
              fontSize: 12,
            }}
          >
            <option>Last hour</option>
            <option>Last 6 hours</option>
            <option>Last 24 hours</option>
            <option>Last 7 days</option>
          </select>
          <select
            style={{
              width: 140,
              height: 28,
              padding: '0 8px',
              borderRadius: 4,
              border: '1px solid var(--border)',
              fontSize: 12,
            }}
          >
            <option>All projects</option>
            <option>Internal CRM</option>
            <option>Marketing Blog</option>
          </select>
          <Button variant="outline" size="sm" type="button">
            Auto-refresh
          </Button>
          <Button size="sm" type="button">
            + Dashboard
          </Button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4" style={{ marginBottom: 16 }}>
        <div className="rounded-md border bg-card p-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            Requests / min
          </div>
          <div className="text-[22px] font-semibold tabular-nums">{lastReq}</div>
          <div className="mt-1 text-[11px] text-muted-foreground text-emerald-600">+12% vs avg</div>
        </div>
        <div className="rounded-md border bg-card p-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            p95 latency
          </div>
          <div className="text-[22px] font-semibold tabular-nums">{lastLat}ms</div>
          <div className="mt-1 text-[11px] text-muted-foreground">SLA: &lt;500ms</div>
        </div>
        <div className="rounded-md border bg-card p-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            Error rate
          </div>
          <div className="text-[22px] font-semibold tabular-nums">0.12%</div>
          <div className="mt-1 text-[11px] text-muted-foreground text-emerald-600">SLA: &lt;1%</div>
        </div>
        <div className="rounded-md border bg-card p-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            Active users
          </div>
          <div className="text-[22px] font-semibold tabular-nums">147</div>
          <div className="mt-1 text-[11px] text-muted-foreground">peak today: 312</div>
        </div>
      </div>

      {/* Requests + Latency */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="rounded-md border bg-card text-card-foreground p-4">
          <div className="mb-3 flex items-center justify-between border-b pb-3">
            <div className="text-sm font-semibold">Requests / min</div>
            <span style={{ fontSize: 11 }}>All endpoints</span>
          </div>
          <MetricChart values={requestsData} color="oklch(0.50 0.20 250)" />
        </div>
        <div className="rounded-md border bg-card text-card-foreground p-4">
          <div className="mb-3 flex items-center justify-between border-b pb-3">
            <div className="text-sm font-semibold">p95 latency Â· ms</div>
          </div>
          <MetricChart values={latencyData} color="oklch(0.55 0.16 145)" />
        </div>
      </div>

      {/* Error rate + CPU + Memory */}
      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}
      >
        <div className="rounded-md border bg-card text-card-foreground p-4">
          <div className="mb-3 flex items-center justify-between border-b pb-3">
            <div className="text-sm font-semibold">Error rate Â· %</div>
            <span style={{ fontSize: 11 }}>2 spikes today</span>
          </div>
          <MetricChart values={errorData} color="oklch(0.55 0.18 25)" />
        </div>
        <div className="rounded-md border bg-card text-card-foreground p-4">
          <div className="mb-3 flex items-center justify-between border-b pb-3">
            <div className="text-sm font-semibold">CPU Â· %</div>
          </div>
          <MetricChart values={cpuData} color="oklch(0.55 0.16 75)" />
        </div>
        <div className="rounded-md border bg-card text-card-foreground p-4">
          <div className="mb-3 flex items-center justify-between border-b pb-3">
            <div className="text-sm font-semibold">Memory Â· %</div>
          </div>
          <MetricChart values={memData} color="oklch(0.50 0.18 285)" />
        </div>
      </div>

      {/* DB connections + Top endpoints */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="rounded-md border bg-card text-card-foreground p-4">
          <div className="mb-3 flex items-center justify-between border-b pb-3">
            <div className="text-sm font-semibold">Database connections Â· active</div>
          </div>
          <MetricChart values={dbConnData} color="oklch(0.50 0.20 250)" max={30} />
          <div style={{ fontSize: 11, marginTop: 8 }}>
            Pool max: 25 Â· current: {lastDb} Â· idle: 6
          </div>
        </div>
        <div className="rounded-md border bg-card text-card-foreground p-4">
          <div className="mb-3 flex items-center justify-between border-b pb-3">
            <div className="text-sm font-semibold">Top endpoints by traffic</div>
          </div>
          <div className="overflow-hidden rounded-md border" style={{ marginTop: -8 }}>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th>Endpoint</th>
                  <th className="tabular-nums">RPS</th>
                  <th className="tabular-nums">p50</th>
                  <th className="tabular-nums">p95</th>
                  <th className="tabular-nums">Errors</th>
                </tr>
              </thead>
              <tbody>
                {TOP_ENDPOINTS.map((ep) => (
                  <tr key={ep.path}>
                    <td className="font-mono text-sm" style={{ fontSize: 11 }}>
                      {ep.path}
                    </td>
                    <td className="tabular-nums">{ep.rps}</td>
                    <td className="tabular-nums" style={{ fontSize: 11 }}>
                      {ep.p50}
                    </td>
                    <td className="tabular-nums" style={{ fontSize: 11 }}>
                      {ep.p95}
                    </td>
                    <td className="tabular-nums" style={{ fontSize: 11 }}>
                      {ep.errors}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
