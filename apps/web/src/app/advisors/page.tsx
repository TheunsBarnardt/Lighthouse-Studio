import Link from 'next/link';

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
  if (status === 'good') return 'pg-badge-success';
  if (status === 'medium') return 'pg-badge-warning';
  if (status === 'attention') return 'pg-badge-danger';
  return 'pg-badge-default';
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
    <div className="pg-page" style={{ maxWidth: 1280 }}>
      <div className="pg-page-header">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--fg-primary)', margin: 0 }}>
            Advisors
          </h1>
          <div style={{ fontSize: 13, color: 'var(--fg-secondary)', marginTop: 4 }}>
            Quality, security, performance, cost — across the entire platform. Last full scan 12
            minutes ago.
          </div>
        </div>
        <div className="pg-page-header-actions">
          <button className="pg-btn pg-btn-secondary pg-btn-sm">Settings</button>
          <button className="pg-btn pg-btn-secondary pg-btn-sm">Schedule scan</button>
          <button className="pg-btn pg-btn-primary pg-btn-sm">▶ Re-scan all</button>
        </div>
      </div>

      {/* Stats */}
      <div className="pg-grid pg-grid-4" style={{ marginBottom: 24 }}>
        <div className="pg-stat-card">
          <div className="pg-stat-label">Quality score</div>
          <div className="pg-stat-value">91</div>
          <div className="pg-stat-delta pg-stat-up">+3 vs last week</div>
        </div>
        <div className="pg-stat-card">
          <div className="pg-stat-label">Open security issues</div>
          <div className="pg-stat-value" style={{ color: 'var(--fg-warning)' }}>
            7
          </div>
          <div className="pg-stat-delta" style={{ color: 'var(--fg-secondary)' }}>
            1 high · 4 medium · 2 low
          </div>
        </div>
        <div className="pg-stat-card">
          <div className="pg-stat-label">DB advisories</div>
          <div className="pg-stat-value">10</div>
          <div className="pg-stat-delta" style={{ color: 'var(--fg-secondary)' }}>
            3 sec · 7 perf
          </div>
        </div>
        <div className="pg-stat-card">
          <div className="pg-stat-label">Cost savings available</div>
          <div className="pg-stat-value">
            $23
            <span style={{ fontSize: 13, color: 'var(--fg-secondary)', fontWeight: 400 }}>/mo</span>
          </div>
          <div className="pg-stat-delta" style={{ color: 'var(--fg-secondary)' }}>
            12% of current spend
          </div>
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
              color: 'var(--fg-tertiary)',
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
                  className="pg-card"
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
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--fg-primary)' }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--fg-tertiary)', marginTop: 4 }}>
                        {item.desc}
                      </div>
                    </div>
                    {item.score !== null && (
                      <div
                        className="pg-tabular"
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
                      borderTop: '1px solid var(--border-default)',
                    }}
                  >
                    <span
                      className={`pg-badge ${statusBadgeClass(item.status)}`}
                      style={{ fontSize: 9 }}
                    >
                      {statusLabel(item.status)}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--fg-secondary)' }}>
                      {item.finding}
                    </span>
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
