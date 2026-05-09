import Link from 'next/link';

import { Button } from '@/components/ui/button';

const GROUPS = [
  {
    title: 'Quality',
    items: [
      {
        title: 'SEO',
        score: '78',
        status: 'medium',
        finding: '6 issues',
        href: '/advisors/seo',
        desc: 'Meta tags, structured data, sitemap, OG cards',
      },
      {
        title: 'Lighthouse / Performance',
        score: '92',
        status: 'good',
        finding: '3 opportunities',
        href: '/advisors/lighthouse',
        desc: 'LCP 1.8s · CLS 0.04 · INP 187ms',
      },
      {
        title: 'Accessibility',
        score: '96',
        status: 'good',
        finding: '2 issues',
        href: '/advisors/a11y',
        desc: 'WCAG 2.1 AA · 2 contrast warnings',
      },
      {
        title: 'Best Practices',
        score: '100',
        status: 'good',
        finding: '0 issues',
        href: '/advisors/best-practices',
        desc: 'HTTPS · no console errors · modern APIs',
      },
    ],
  },
  {
    title: 'Security',
    items: [
      {
        title: 'CVE / Dependencies',
        score: null,
        status: 'attention',
        finding: '4 vulns',
        href: '/advisors/cve',
        desc: '1 high · 2 medium · 1 low across 412 deps',
      },
      {
        title: 'Pentest / DAST',
        score: null,
        status: 'good',
        finding: '0 high',
        href: '/advisors/pentest',
        desc: 'OWASP Top 10 · last scan 4 days ago',
      },
      {
        title: 'SAST / Static analysis',
        score: null,
        status: 'good',
        finding: '0 critical',
        href: '/advisors/sast',
        desc: 'No eval, no child_process, no fs/net direct',
      },
    ],
  },
  {
    title: 'Database',
    items: [
      {
        title: 'DB Security',
        score: null,
        status: 'attention',
        finding: '3 issues',
        href: '/advisors/db-security',
        desc: 'RLS disabled on 22 tables',
      },
      {
        title: 'DB Performance',
        score: null,
        status: 'medium',
        finding: '7 optimisations',
        href: '/advisors/db-performance',
        desc: 'Missing indexes, bloat, unused indexes',
      },
      {
        title: 'Query Performance',
        score: null,
        status: 'good',
        finding: 'normal',
        href: '/advisors/query-performance',
        desc: 'p95 < 200ms across all routes',
      },
    ],
  },
  {
    title: 'Cost',
    items: [
      {
        title: 'Cost optimisation',
        score: null,
        status: 'medium',
        finding: '$23/mo savings',
        href: '/advisors/cost',
        desc: 'AI token usage, idle resources',
      },
    ],
  },
];

function statusBadgeClass(status: string) {
  if (status === 'good')
    return 'inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
  if (status === 'medium')
    return 'inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
  if (status === 'attention')
    return 'inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive';
  return 'inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground';
}

function statusLabel(status: string) {
  if (status === 'good') return 'Good';
  if (status === 'medium') return 'Watch';
  if (status === 'attention') return 'Attention';
  return '—';
}

function scoreColor(status: string) {
  if (status === 'good') return 'var(--fg-success)';
  if (status === 'medium') return 'var(--fg-warning)';
  return 'var(--fg-danger)';
}

export default function AdvisorsPage() {
  return (
    <div className="mx-auto max-w-[1440px] p-6" style={{ maxWidth: 1280 }}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Advisors</h1>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            Quality, security, performance, cost — across the entire platform. Last full scan 12
            minutes ago.
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" type="button">
            Settings
          </Button>
          <Button variant="outline" size="sm" type="button">
            Schedule scan
          </Button>
          <Button size="sm" type="button">
            ▶ Re-scan all
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4" style={{ marginBottom: 24 }}>
        <div className="rounded-md border bg-card p-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            Quality score
          </div>
          <div className="text-[22px] font-semibold tabular-nums">91</div>
          <div className="mt-1 text-[11px] text-muted-foreground text-emerald-600">
            +3 vs last week
          </div>
        </div>
        <div className="rounded-md border bg-card p-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            Open security issues
          </div>
          <div className="text-[22px] font-semibold tabular-nums">7</div>
          <div className="mt-1 text-[11px] text-muted-foreground">1 high · 4 medium · 2 low</div>
        </div>
        <div className="rounded-md border bg-card p-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            DB advisories
          </div>
          <div className="text-[22px] font-semibold tabular-nums">10</div>
          <div className="mt-1 text-[11px] text-muted-foreground">3 sec · 7 perf</div>
        </div>
        <div className="rounded-md border bg-card p-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            Cost savings available
          </div>
          <div className="text-[22px] font-semibold tabular-nums">
            $23
            <span style={{ fontSize: 13, fontWeight: 400 }}>/mo</span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">12% of current spend</div>
        </div>
      </div>

      {/* Advisor groups */}
      {GROUPS.map((group) => (
        <div key={group.title} style={{ marginBottom: 32 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 12,
            }}
          >
            {group.title}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 12,
            }}
          >
            {group.items.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div
                  className="rounded-md border bg-card text-card-foreground p-4"
                  style={{ cursor: 'pointer', transition: 'border-color 100ms' }}
                  onMouseOver={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-primary)';
                  }}
                  onMouseOut={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = '';
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
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{item.title}</div>
                      <div style={{ fontSize: 11, marginTop: 4 }}>{item.desc}</div>
                    </div>
                    {item.score !== null && (
                      <div
                        className="tabular-nums"
                        style={{
                          fontSize: 22,
                          fontWeight: 600,
                          color: scoreColor(item.status),
                          marginLeft: 12,
                          flexShrink: 0,
                        }}
                      >
                        {item.score}
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      paddingTop: 8,
                    }}
                  >
                    <span
                      className={`inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground ${statusBadgeClass(item.status)}`}
                      style={{ fontSize: 9 }}
                    >
                      {statusLabel(item.status)}
                    </span>
                    <span style={{ fontSize: 11 }}>{item.finding}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
