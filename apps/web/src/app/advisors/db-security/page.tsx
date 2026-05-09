'use client';

import { Button } from '@/components/ui/button';

const ISSUES = [
  {
    sev: 'high',
    title: 'RLS disabled on 22 tables',
    desc: 'Service-layer auth is in place but DB-level RLS recommended.',
  },
  {
    sev: 'medium',
    title: 'Function `handle_new_user` has SECURITY DEFINER',
    desc: 'Functions with SECURITY DEFINER bypass RLS.',
  },
  {
    sev: 'low',
    title: 'Postgres role `service_role` has broad permissions',
    desc: 'Restrict to API server only.',
  },
];

export default function DbSecurityPage() {
  return (
    <div style={{ padding: '16px 24px' }}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Security Advisor</h1>
          <div style={{ fontSize: 13, marginTop: 4 }}>3 issues · Last scan 12 min ago</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" type="button">
            Re-scan
          </Button>
        </div>
      </div>

      {ISSUES.map((issue) => (
        <div
          key={issue.title}
          className="rounded-md border bg-card text-card-foreground p-4"
          style={{ marginBottom: 12 }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                className={`inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground ${issue.sev === 'high' ? 'inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive' : issue.sev === 'medium' ? 'inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground'}`}
              >
                {issue.sev.toUpperCase()}
              </span>
              <strong style={{ fontSize: 13 }}>{issue.title}</strong>
            </div>
            <Button variant="outline" size="sm" type="button">
              Review
            </Button>
          </div>
          <div style={{ fontSize: 13 }}>{issue.desc}</div>
        </div>
      ))}
    </div>
  );
}
