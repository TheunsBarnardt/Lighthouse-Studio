import type React from 'react';

function AuditRow({
  status,
  name,
  count,
  desc,
  action,
}: {
  status: 'pass' | 'warn' | 'fail';
  name: string;
  count?: string;
  desc?: string;
  action?: string;
}) {
  const iconStyle: React.CSSProperties = {
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
    background:
      status === 'pass'
        ? 'var(--bg-success-subtle)'
        : status === 'fail'
          ? 'var(--bg-danger-subtle)'
          : 'var(--bg-warning-subtle)',
    color:
      status === 'pass'
        ? 'var(--fg-success)'
        : status === 'fail'
          ? 'var(--fg-danger)'
          : 'var(--fg-warning)',
  };
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 0',
        borderBottom: '1px solid var(--border-default)',
      }}
    >
      <div style={iconStyle}>{status === 'pass' ? '✓' : status === 'fail' ? '✕' : '!'}</div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--fg-primary)' }}>{name}</div>
          {count && <div style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}>{count}</div>}
        </div>
        {desc && (
          <div style={{ fontSize: 11, color: 'var(--fg-secondary)', marginTop: 4 }}>{desc}</div>
        )}
      </div>
      {action && status !== 'pass' && (
        <button className="pg-btn pg-btn-secondary pg-btn-sm">{action}</button>
      )}
    </div>
  );
}

const GROUPS = [
  {
    cat: 'Dangerous APIs',
    items: [
      {
        name: 'No use of eval() or Function()',
        status: 'pass' as const,
        count: '0 occurrences across 7 functions',
      },
      { name: 'No use of child_process', status: 'pass' as const, count: '0 occurrences' },
      { name: 'No direct fs.* or net.* calls', status: 'pass' as const, count: '0 occurrences' },
      {
        name: 'No use of process.env outside config',
        status: 'pass' as const,
        count: '0 violations',
      },
    ],
  },
  {
    cat: 'Secrets in code',
    items: [
      {
        name: 'No hardcoded API keys',
        status: 'pass' as const,
        count: '0 detected (TruffleHog rules)',
      },
      { name: 'No hardcoded passwords', status: 'pass' as const, count: '0 detected' },
      { name: 'No hardcoded JWTs', status: 'pass' as const, count: '0 detected' },
      { name: 'No private keys in repo', status: 'pass' as const, count: '0 detected' },
    ],
  },
  {
    cat: 'Common vulnerabilities',
    items: [
      {
        name: 'No SQL string concatenation',
        status: 'warn' as const,
        count: '1 finding · /api/search ORDER BY clause',
        desc: 'Identified by SAST · also flagged by DAST as PT-014. Use a whitelist of valid sort columns.',
      },
      {
        name: 'No XSS sinks (innerHTML, dangerouslySetInnerHTML)',
        status: 'pass' as const,
        count: '0 violations',
      },
      { name: 'No insecure regex (ReDoS)', status: 'pass' as const, count: '0 violations' },
      { name: 'No path traversal patterns', status: 'pass' as const, count: '0 violations' },
    ],
  },
  {
    cat: 'Code quality (security-adjacent)',
    items: [
      { name: 'No unhandled promise rejections', status: 'pass' as const },
      { name: 'No catch-and-ignore patterns', status: 'pass' as const },
      {
        name: 'Logging sensitive data',
        status: 'pass' as const,
        count: 'No PII or tokens in log statements',
      },
      {
        name: 'Cryptographic operations use approved libs',
        status: 'pass' as const,
        count: 'argon2, jose, crypto.subtle only',
      },
    ],
  },
];

const TREND = [
  3, 2, 4, 3, 2, 1, 2, 3, 2, 1, 1, 2, 1, 2, 1, 1, 2, 1, 1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1, 1,
];

export default function SastPage() {
  return (
    <div className="pg-page" style={{ maxWidth: 1280 }}>
      <div className="pg-page-header">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--fg-primary)', margin: 0 }}>
            SAST · Static analysis
          </h1>
          <div style={{ fontSize: 13, color: 'var(--fg-secondary)', marginTop: 4 }}>
            CodeQL + Semgrep + custom rules · Runs on every commit · Last run 12 minutes ago
          </div>
        </div>
        <div className="pg-page-header-actions">
          <button className="pg-btn pg-btn-secondary pg-btn-sm">Rules</button>
          <button className="pg-btn pg-btn-secondary pg-btn-sm">SARIF export</button>
          <button className="pg-btn pg-btn-primary pg-btn-sm">Re-scan</button>
        </div>
      </div>

      <div className="pg-grid pg-grid-4" style={{ marginBottom: 16 }}>
        <div className="pg-stat-card">
          <div className="pg-stat-label">Files scanned</div>
          <div className="pg-stat-value">142</div>
          <div className="pg-stat-delta" style={{ color: 'var(--fg-secondary)' }}>
            42K LOC
          </div>
        </div>
        <div className="pg-stat-card">
          <div className="pg-stat-label">Rules active</div>
          <div className="pg-stat-value">347</div>
          <div className="pg-stat-delta" style={{ color: 'var(--fg-secondary)' }}>
            CodeQL + Semgrep + custom
          </div>
        </div>
        <div className="pg-stat-card">
          <div className="pg-stat-label">Open findings</div>
          <div className="pg-stat-value" style={{ color: 'var(--fg-warning)' }}>
            1
          </div>
          <div className="pg-stat-delta" style={{ color: 'var(--fg-secondary)' }}>
            1 medium
          </div>
        </div>
        <div className="pg-stat-card">
          <div className="pg-stat-label">Critical / High</div>
          <div className="pg-stat-value" style={{ color: 'var(--fg-success)' }}>
            0
          </div>
          <div className="pg-stat-delta pg-stat-up">none open</div>
        </div>
      </div>

      <div
        className="pg-card"
        style={{
          marginBottom: 16,
          background: 'var(--bg-info-subtle)',
          borderColor: 'var(--accent-primary)',
        }}
      >
        <div style={{ fontSize: 13 }}>
          <strong>Defense in depth.</strong> SAST analyses your source code without running it; DAST
          attacks the running app. Findings often correlate — the SQL injection found here (
          <span className="pg-mono">/api/search</span>) is also flagged by the Pentest advisor as
          PT-014.
        </div>
      </div>

      {GROUPS.map((g) => (
        <div className="pg-card" key={g.cat} style={{ marginBottom: 16 }}>
          <div className="pg-card-header">
            <div className="pg-card-title">{g.cat}</div>
            <div style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}>
              {g.items.filter((i) => i.status === 'pass').length} of {g.items.length}
            </div>
          </div>
          {g.items.map((item) => (
            <AuditRow key={item.name} {...item} action="View" />
          ))}
        </div>
      ))}

      <div className="pg-card">
        <div className="pg-card-header">
          <div className="pg-card-title">Findings · 30 days</div>
        </div>
        <div
          style={{
            height: 100,
            background: 'var(--bg-canvas)',
            borderRadius: 4,
            padding: 12,
            display: 'flex',
            alignItems: 'flex-end',
            gap: 3,
          }}
        >
          {TREND.map((v, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: `${String(v * 22)}%`,
                background: v >= 3 ? 'var(--fg-warning)' : 'var(--fg-success)',
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
          <span>30 days ago · 3 open</span>
          <span>Today · 1 open</span>
        </div>
      </div>
    </div>
  );
}
