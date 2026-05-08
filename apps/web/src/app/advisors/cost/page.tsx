'use client';

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
    <div className="pg-page" style={{ maxWidth: 1280 }}>
      <div className="pg-page-header">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--fg-primary)', margin: 0 }}>
            Cost optimisation
          </h1>
          <div style={{ fontSize: 13, color: 'var(--fg-secondary)', marginTop: 4 }}>
            Spend across all sources · ${total.toFixed(2)} / mo current · ${(total - 23).toFixed(2)}{' '}
            / mo achievable
          </div>
        </div>
        <div className="pg-page-header-actions">
          <select
            style={{
              width: 140,
              height: 28,
              padding: '0 8px',
              borderRadius: 4,
              border: '1px solid var(--border-default)',
              background: 'var(--bg-canvas)',
              color: 'var(--fg-primary)',
              fontSize: 12,
            }}
          >
            <option>This month</option>
            <option>Last 30 days</option>
            <option>Last quarter</option>
          </select>
          <button className="pg-btn pg-btn-primary pg-btn-sm">Re-analyse</button>
        </div>
      </div>

      <div className="pg-grid pg-grid-4" style={{ marginBottom: 16 }}>
        <div className="pg-stat-card">
          <div className="pg-stat-label">Current spend</div>
          <div className="pg-stat-value">
            ${total.toFixed(2)}
            <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--fg-secondary)' }}>/mo</span>
          </div>
          <div className="pg-stat-delta" style={{ color: 'var(--fg-secondary)' }}>
            vs $50 budget
          </div>
        </div>
        <div className="pg-stat-card">
          <div className="pg-stat-label">Identified savings</div>
          <div className="pg-stat-value" style={{ color: 'var(--fg-success)' }}>
            $23.00
            <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--fg-secondary)' }}>/mo</span>
          </div>
          <div className="pg-stat-delta pg-stat-up">47% reduction</div>
        </div>
        <div className="pg-stat-card">
          <div className="pg-stat-label">Top driver</div>
          <div className="pg-stat-value">AI</div>
          <div className="pg-stat-delta" style={{ color: 'var(--fg-secondary)' }}>
            47.5% of spend
          </div>
        </div>
        <div className="pg-stat-card">
          <div className="pg-stat-label">Forecast next month</div>
          <div className="pg-stat-value">$54.20</div>
          <div className="pg-stat-delta" style={{ color: 'var(--fg-warning)' }}>
            +9.6% growth
          </div>
        </div>
      </div>

      {/* Spend breakdown */}
      <div className="pg-card" style={{ marginBottom: 16 }}>
        <div className="pg-card-header">
          <div className="pg-card-title">Spend breakdown</div>
          <div style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}>Last 30 days</div>
        </div>
        <div className="pg-table-wrap">
          <table className="pg-data-table">
            <thead>
              <tr>
                <th>Source</th>
                <th className="pg-tabular">Amount</th>
                <th className="pg-tabular">Share</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {BREAKDOWN.map((b) => (
                <tr key={b.name}>
                  <td style={{ fontWeight: 500 }}>{b.name}</td>
                  <td className="pg-tabular">${b.amt.toFixed(2)}</td>
                  <td className="pg-tabular">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>{b.pct}%</span>
                      <div
                        style={{
                          flex: 1,
                          height: 4,
                          background: 'var(--bg-hover)',
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
                  <td style={{ fontSize: 11, color: 'var(--fg-secondary)' }}>{b.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Opportunities */}
      <div className="pg-card" style={{ marginBottom: 16 }}>
        <div className="pg-card-header">
          <div className="pg-card-title">Optimisation opportunities</div>
          <span className="pg-badge pg-badge-success">$23.00 / mo</span>
        </div>
        {OPPORTUNITIES.map((o) => (
          <div
            key={o.name}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '12px 0',
              borderBottom: '1px solid var(--border-default)',
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
                color: 'var(--fg-warning)',
              }}
            >
              $
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{o.name}</div>
                <div style={{ fontSize: 11, color: 'var(--fg-success)', fontWeight: 600 }}>
                  Save {o.savings}
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--fg-secondary)' }}>{o.desc}</div>
              <div style={{ fontSize: 11, color: 'var(--fg-tertiary)', marginTop: 4 }}>
                Effort: {o.effort}
              </div>
            </div>
            <button className="pg-btn pg-btn-secondary pg-btn-sm">Apply</button>
          </div>
        ))}
      </div>

      {/* Trend chart */}
      <div className="pg-card">
        <div className="pg-card-header">
          <div className="pg-card-title">Cost trend · 90 days</div>
        </div>
        <div
          style={{
            height: 120,
            background: 'var(--bg-canvas)',
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
            color: 'var(--fg-tertiary)',
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
