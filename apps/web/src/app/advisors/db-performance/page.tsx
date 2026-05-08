'use client';

const RECOMMENDATIONS = [
  {
    title: 'Missing index on `contacts.company`',
    desc: 'Frequent filter without an index. p95 1.8s.',
    improvement: '~80% improvement',
  },
  {
    title: 'Sequential scan on `audit_log`',
    desc: 'Filter by `actor_id` lacks index.',
    improvement: '~95% improvement',
  },
  {
    title: 'Unused index `deals_old_stage_idx`',
    desc: 'Not used in 30 days.',
    improvement: 'Saves 24 kB',
  },
  {
    title: 'Bloated table `messages`',
    desc: '64 kB allocated for 47 rows.',
    improvement: 'Reclaims 56 kB',
  },
];

export default function DbPerformancePage() {
  return (
    <div style={{ padding: '16px 24px' }}>
      <div className="pg-page-header">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg-primary)', margin: 0 }}>
            Performance Advisor
          </h1>
          <div style={{ fontSize: 13, color: 'var(--fg-secondary)', marginTop: 4 }}>
            7 optimizations recommended
          </div>
        </div>
        <div className="pg-page-header-actions">
          <button className="pg-btn pg-btn-primary pg-btn-sm">Re-scan</button>
        </div>
      </div>

      {RECOMMENDATIONS.map((rec) => (
        <div key={rec.title} className="pg-card" style={{ marginBottom: 12 }}>
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
          >
            <div>
              <strong style={{ fontSize: 13 }}>{rec.title}</strong>
              <div style={{ fontSize: 13, color: 'var(--fg-secondary)', marginTop: 4 }}>
                {rec.desc}
              </div>
              <div style={{ fontSize: 12, color: 'var(--fg-success)', marginTop: 6 }}>
                {rec.improvement}
              </div>
            </div>
            <button className="pg-btn pg-btn-secondary pg-btn-sm">View SQL</button>
          </div>
        </div>
      ))}
    </div>
  );
}
