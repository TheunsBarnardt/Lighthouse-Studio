'use client';

import { Button } from '@/components/ui/button';

const PENDING = [
  {
    id: 'AP-247',
    stage: 'Stage 9 Â· Production deploy',
    project: 'Internal Sales CRM',
    requester: 'Marcus Acker',
    requested: '12 min ago',
    mode: 'all_of',
    approved: 1,
    total: 2,
    urgent: true,
    summary: 'v0.1.3 â†’ production. 14 components, 7 functions, 3 schema migrations. Tests passing.',
  },
  {
    id: 'AP-246',
    stage: 'Stage 7 Â· Code generation',
    project: 'Internal Sales CRM',
    requester: 'AI',
    requested: '47 min ago',
    mode: 'all_of',
    approved: 0,
    total: 2,
    urgent: false,
    summary:
      'Generated `outlookCalendarSync` integration function. 142 lines, sandboxed, OAuth scoped to read+write calendar.',
  },
  {
    id: 'AP-245',
    stage: 'Stage 6 Â· UI generation',
    project: 'Marketing Blog',
    requester: 'AI',
    requested: '2 hours ago',
    mode: 'any_of',
    approved: 0,
    total: 2,
    urgent: false,
    summary: 'Generated `BlogPostPage` and `RelatedPostsList`. 2 new components.',
  },
  {
    id: 'AP-244',
    stage: 'Stage 2 Â· PRD section',
    project: 'Internal Sales CRM',
    requester: 'Joana de Klerk',
    requested: '4 hours ago',
    mode: 'all_of',
    approved: 0,
    total: 1,
    urgent: false,
    summary: 'Functional Requirements section Â· 12 FRs Â· 3 traced to intent.',
  },
];

const APPROVED = [
  {
    id: 'AP-243',
    what: 'Stage 4 Â· Schema synthesis',
    project: 'Internal Sales CRM',
    by: 'Marcus, Joana',
    when: '5h ago',
    tta: '42m',
  },
  {
    id: 'AP-242',
    what: 'Stage 3 Â· Design tokens',
    project: 'Internal Sales CRM',
    by: 'Joana',
    when: '7h ago',
    tta: '2h 4m',
  },
  {
    id: 'AP-241',
    what: 'Stage 9 Â· Staging deploy',
    project: 'Marketing Blog',
    by: 'Sara, Tom',
    when: 'Yesterday',
    tta: '18m',
  },
  {
    id: 'AP-240',
    what: 'Stage 7 Â· Code generation',
    project: 'Internal Sales CRM',
    by: 'Marcus, Tom',
    when: 'Yesterday',
    tta: '1h 12m',
  },
];

export default function ApprovalsPage() {
  return (
    <div className="mx-auto max-w-[1440px] p-6" style={{ maxWidth: 1280 }}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Approvals</h1>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            Single inbox of pending approvals across all projects Â· 4 pending Â· 2 awaiting you
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" type="button">
            Settings
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4" style={{ marginBottom: 24 }}>
        <div className="rounded-md border bg-card p-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            Pending
          </div>
          <div className="text-[22px] font-semibold tabular-nums">4</div>
          <div className="mt-1 text-[11px] text-muted-foreground">across 2 projects</div>
        </div>
        <div className="rounded-md border bg-card p-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            Awaiting you
          </div>
          <div className="text-[22px] font-semibold tabular-nums">2</div>
          <div className="mt-1 text-[11px] text-muted-foreground">1 urgent</div>
        </div>
        <div className="rounded-md border bg-card p-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            Approved Â· 7d
          </div>
          <div className="text-[22px] font-semibold tabular-nums">23</div>
          <div className="mt-1 text-[11px] text-muted-foreground">avg time-to-approve 1h 47m</div>
        </div>
        <div className="rounded-md border bg-card p-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            Rejected Â· 7d
          </div>
          <div className="text-[22px] font-semibold tabular-nums">2</div>
          <div className="mt-1 text-[11px] text-muted-foreground">all returned for changes</div>
        </div>
      </div>

      {/* Pending cards */}
      {PENDING.map((a) => (
        <div
          key={a.id}
          className="rounded-md border bg-card text-card-foreground p-4"
          style={{
            marginBottom: 12,
            borderColor: a.urgent ? 'oklch(0.45 0.14 75)' : undefined,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary font-mono text-sm">
                {a.id}
              </span>
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {a.stage}
              </span>
              <span style={{ fontSize: 12 }}>{a.project}</span>
              {a.urgent && (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  Urgent
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <Button variant="ghost" size="sm" type="button">
                View details
              </Button>
              <Button variant="outline" size="sm" type="button">
                Reject
              </Button>
              <Button size="sm" type="button">
                Approve
              </Button>
            </div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>{a.summary}</div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 11,
            }}
          >
            <span>Requested by {a.requester}</span>
            <span>Â·</span>
            <span>{a.requested}</span>
            <span>Â·</span>
            <span>
              Mode: <span className="font-mono text-sm">{a.mode}</span> Â· {a.approved} of {a.total}{' '}
              approved
            </span>
          </div>
        </div>
      ))}

      {/* Recently approved table */}
      <div className="rounded-md border bg-card text-card-foreground p-4" style={{ marginTop: 16 }}>
        <div className="mb-3 flex items-center justify-between border-b pb-3">
          <div className="text-sm font-semibold">Recently approved Â· 7 days</div>
        </div>
        <div className="overflow-hidden rounded-md border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th>ID</th>
                <th>What</th>
                <th>Project</th>
                <th>Approved by</th>
                <th>When</th>
                <th>TTA</th>
              </tr>
            </thead>
            <tbody>
              {APPROVED.map((row) => (
                <tr key={row.id}>
                  <td className="font-mono text-sm" style={{ fontSize: 11 }}>
                    {row.id}
                  </td>
                  <td style={{ fontSize: 13 }}>{row.what}</td>
                  <td style={{ fontSize: 11 }}>{row.project}</td>
                  <td style={{ fontSize: 11 }}>{row.by}</td>
                  <td style={{ fontSize: 11 }}>{row.when}</td>
                  <td className="tabular-nums" style={{ fontSize: 11 }}>
                    {row.tta}
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
