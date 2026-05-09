'use client';

import { Button } from '@/components/ui/button';

const OPPORTUNITIES = [
  {
    name: 'AI tokens · Stage 6 (UI gen)',
    savings: '$8.40/mo',
    desc: 'Switch DealKanbanPage to cached prompt template (similar to ContactsTable). Same quality, ~62% fewer input tokens.',
    effort: 'medium',
  },
  {
    name: 'Database storage',
    savings: '$6.20/mo',
    desc: 'Vacuum bloated tables (messages, audit_log_archive). Reclaim 1.4 GB.',
    effort: 'low',
  },
  {
    name: 'Idle edge function workers',
    savings: '$4.10/mo',
    desc: 'outlookCalendarSync provisioned at 4 workers; only ever runs at 1 concurrent. Drop to 1 + burst.',
    effort: 'low',
  },
  {
    name: 'Storage egress to Backblaze',
    savings: '$3.20/mo',
    desc: 'Hot files re-uploaded daily. Cache headers 24h instead of 1h.',
    effort: 'low',
  },
  {
    name: 'Logs retention',
    savings: '$1.10/mo',
    desc: 'Verbose API logs retained 30 days. 7 days enough for current SLAs.',
    effort: 'low',
  },
];

const BREAKDOWN = [
  {
    name: 'AI tokens',
    amt: 23.4,
    pct: 47.5,
    detail: 'Anthropic Claude · Sonnet 4.6 · Opus 4.7 (Stage 6 only)',
  },
  {
    name: 'Database (compute)',
    amt: 12.2,
    pct: 24.7,
    detail: 'PostgreSQL · 4 vCPU · 8 GB · 100 GB SSD',
  },
  { name: 'Database (storage)', amt: 4.8, pct: 9.7, detail: '38 GB used of 100 GB' },
  { name: 'Edge functions', amt: 3.4, pct: 6.9, detail: '142K invocations · avg 87ms' },
  { name: 'Storage', amt: 2.8, pct: 5.7, detail: '1.2 GB · Backblaze B2' },
  { name: 'Realtime', amt: 1.4, pct: 2.8, detail: '147 concurrent connections' },
  { name: 'Logs & monitoring', amt: 1.2, pct: 2.4, detail: '7-day retention' },
];

const TREND = [
  28, 30, 32, 34, 32, 35, 38, 36, 40, 42, 40, 44, 46, 44, 46, 48, 46, 48, 49, 46, 48, 49, 47, 49,
  46, 48, 50, 48, 49,
];
const total = BREAKDOWN.reduce((s, b) => s + b.amt, 0);

export default function CostPage() {
  return (
    <div className="mx-auto max-w-[1440px] p-6" style={{ maxWidth: 1280 }}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Cost optimisation</h1>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            Spend across all sources · ${total.toFixed(2)} / mo current · ${(total - 23).toFixed(2)}{' '}
            / mo achievable
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <select
            style={{
              width: 140,
              height: 28,
              padding: '0 8px',
              borderRadius: 4,
              border: '1px solid var(--border-default)',
              fontSize: 12,
            }}
          >
            <option>This month</option>
            <option>Last 30 days</option>
            <option>Last quarter</option>
          </select>
          <Button size="sm" type="button">
            Re-analyse
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4" style={{ marginBottom: 16 }}>
        <div className="rounded-md border bg-card p-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            Current spend
          </div>
          <div className="text-[22px] font-semibold tabular-nums">
            ${total.toFixed(2)}
            <span style={{ fontSize: 13, fontWeight: 400 }}>/mo</span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">vs $50 budget</div>
        </div>
        <div className="rounded-md border bg-card p-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            Identified savings
          </div>
          <div className="text-[22px] font-semibold tabular-nums">
            $23.00
            <span style={{ fontSize: 13, fontWeight: 400 }}>/mo</span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground text-emerald-600">
            47% reduction
          </div>
        </div>
        <div className="rounded-md border bg-card p-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            Top driver
          </div>
          <div className="text-[22px] font-semibold tabular-nums">AI</div>
          <div className="mt-1 text-[11px] text-muted-foreground">47.5% of spend</div>
        </div>
        <div className="rounded-md border bg-card p-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            Forecast next month
          </div>
          <div className="text-[22px] font-semibold tabular-nums">$54.20</div>
          <div className="mt-1 text-[11px] text-muted-foreground">+9.6% growth</div>
        </div>
      </div>

      {/* Spend breakdown */}
      <div
        className="rounded-md border bg-card text-card-foreground p-4"
        style={{ marginBottom: 16 }}
      >
        <div className="mb-3 flex items-center justify-between border-b pb-3">
          <div className="text-sm font-semibold">Spend breakdown</div>
          <div style={{ fontSize: 11 }}>Last 30 days</div>
        </div>
        <div className="overflow-hidden rounded-md border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th>Source</th>
                <th className="tabular-nums">Amount</th>
                <th className="tabular-nums">Share</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {BREAKDOWN.map((b) => (
                <tr key={b.name}>
                  <td style={{ fontWeight: 500 }}>{b.name}</td>
                  <td className="tabular-nums">${b.amt.toFixed(2)}</td>
                  <td className="tabular-nums">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>{b.pct}%</span>
                      <div
                        style={{
                          flex: 1,
                          height: 4,
                          borderRadius: 2,
                          maxWidth: 80,
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${String(b.pct)}%`,
                            background: 'var(--accent-primary)',
                            borderRadius: 2,
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: 11 }}>{b.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Opportunities */}
      <div
        className="rounded-md border bg-card text-card-foreground p-4"
        style={{ marginBottom: 16 }}
      >
        <div className="mb-3 flex items-center justify-between border-b pb-3">
          <div className="text-sm font-semibold">Optimisation opportunities</div>
          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            $23.00 / mo
          </span>
        </div>
        {OPPORTUNITIES.map((o) => (
          <div
            key={o.name}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '12px 0',
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
                flexShrink: 0,
                marginTop: 2,
                background: 'var(--bg-warning-subtle)',
              }}
            >
              $
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{o.name}</div>
                <div style={{ fontSize: 11, fontWeight: 600 }}>Save {o.savings}</div>
              </div>
              <div style={{ fontSize: 11 }}>{o.desc}</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>Effort: {o.effort}</div>
            </div>
            <Button variant="outline" size="sm" type="button">
              Apply
            </Button>
          </div>
        ))}
      </div>

      {/* Trend chart */}
      <div className="rounded-md border bg-card text-card-foreground p-4">
        <div className="mb-3 flex items-center justify-between border-b pb-3">
          <div className="text-sm font-semibold">Cost trend · 90 days</div>
        </div>
        <div
          style={{
            height: 120,
            borderRadius: 4,
            padding: 12,
            display: 'flex',
            alignItems: 'flex-end',
            gap: 2,
          }}
        >
          {TREND.map((v, i) => (
            <div
              key={i}
              title={`$${String(v)}`}
              style={{
                flex: 1,
                height: `${String((v - 20) * 3)}%`,
                background: 'var(--accent-primary)',
                borderRadius: '2px 2px 0 0',
                opacity: 0.85,
              }}
            />
          ))}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11,
            marginTop: 8,
          }}
        >
          <span>90 days ago · $28</span>
          <span>Today · ${total.toFixed(0)}</span>
        </div>
      </div>
    </div>
  );
}
