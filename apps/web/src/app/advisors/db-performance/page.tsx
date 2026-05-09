'use client';

import { Button } from '@/components/ui/button';

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
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Performance Advisor</h1>
          <div style={{ fontSize: 13, marginTop: 4 }}>7 optimizations recommended</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" type="button">
            Re-scan
          </Button>
        </div>
      </div>

      {RECOMMENDATIONS.map((rec) => (
        <div
          key={rec.title}
          className="rounded-md border bg-card text-card-foreground p-4"
          style={{ marginBottom: 12 }}
        >
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
          >
            <div>
              <strong style={{ fontSize: 13 }}>{rec.title}</strong>
              <div style={{ fontSize: 13, marginTop: 4 }}>{rec.desc}</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>{rec.improvement}</div>
            </div>
            <Button variant="outline" size="sm" type="button">
              View SQL
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
