'use client';

const VULNS = [
  {
    id: 'GHSA-jf85-cpcp-j695',
    cve: 'CVE-2020-8203',
    pkg: 'lodash',
    current: '4.17.20',
    fixed: '4.17.21',
    severity: 'high',
    cvss: 7.4,
    type: 'Prototype Pollution',
    desc: 'Versions of lodash prior to 4.17.21 are vulnerable to Prototype Pollution via zipObjectDeep.',
    exploitable: true,
    age: '2 days ago',
    via: 'direct dependency',
  },
  {
    id: 'GHSA-72xf-g2v4-qvf3',
    cve: 'CVE-2024-28849',
    pkg: 'follow-redirects',
    current: '1.15.4',
    fixed: '1.15.6',
    severity: 'medium',
    cvss: 6.5,
    type: 'Information Exposure',
    desc: 'follow-redirects leaks the proxy authorization header on cross-origin redirects.',
    exploitable: false,
    age: '5 days ago',
    via: 'transitive · axios → follow-redirects',
  },
  {
    id: 'GHSA-c2qf-rxjj-qqgw',
    cve: 'CVE-2023-26159',
    pkg: 'follow-redirects',
    current: '1.15.4',
    fixed: '1.15.4',
    severity: 'medium',
    cvss: 5.3,
    type: 'Improper Input Validation',
    desc: 'Improper Input Validation in follow-redirects.',
    exploitable: false,
    age: '1 week ago',
    via: 'transitive · axios → follow-redirects',
  },
  {
    id: 'GHSA-cwfw-4gq5-mrqx',
    cve: 'CVE-2024-21484',
    pkg: 'jose',
    current: '4.15.4',
    fixed: '4.15.5',
    severity: 'low',
    cvss: 3.7,
    type: 'DoS',
    desc: 'Denial of Service via memory exhaustion when parsing tokens with deeply nested structures.',
    exploitable: false,
    age: '2 weeks ago',
    via: 'direct dependency',
  },
];

const ECOSYSTEM = [
  { name: 'npm (production)', deps: 142, vulns: 2, audited: '2 min ago' },
  { name: 'npm (dev)', deps: 270, vulns: 2, audited: '2 min ago' },
  { name: 'PostgreSQL extensions', deps: 5, vulns: 0, audited: 'daily' },
  { name: 'Container base images', deps: 3, vulns: 0, audited: '4 hours ago' },
];

export default function CvePage() {
  return (
    <div className="pg-page" style={{ maxWidth: 1280 }}>
      <div className="pg-page-header">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--fg-primary)', margin: 0 }}>
            CVE / Dependencies
          </h1>
          <div style={{ fontSize: 13, color: 'var(--fg-secondary)', marginTop: 4 }}>
            Continuous vulnerability monitoring · GHSA · NVD · OSV.dev · Last scan 2 minutes ago
          </div>
        </div>
        <div className="pg-page-header-actions">
          <button className="pg-btn pg-btn-secondary pg-btn-sm">SBOM export</button>
          <button className="pg-btn pg-btn-secondary pg-btn-sm">Settings</button>
          <button className="pg-btn pg-btn-primary pg-btn-sm">Re-scan</button>
        </div>
      </div>

      <div className="pg-grid pg-grid-4" style={{ marginBottom: 16 }}>
        <div className="pg-stat-card">
          <div className="pg-stat-label">Total vulnerabilities</div>
          <div className="pg-stat-value">4</div>
          <div className="pg-stat-delta" style={{ color: 'var(--fg-secondary)' }}>
            across 412 deps
          </div>
        </div>
        <div className="pg-stat-card">
          <div className="pg-stat-label">High</div>
          <div className="pg-stat-value" style={{ color: 'var(--fg-danger)' }}>
            1
          </div>
          <div className="pg-stat-delta" style={{ color: 'var(--fg-secondary)' }}>
            CVSS ≥ 7.0
          </div>
        </div>
        <div className="pg-stat-card">
          <div className="pg-stat-label">Medium</div>
          <div className="pg-stat-value" style={{ color: 'var(--fg-warning)' }}>
            2
          </div>
          <div className="pg-stat-delta" style={{ color: 'var(--fg-secondary)' }}>
            4.0–6.9
          </div>
        </div>
        <div className="pg-stat-card">
          <div className="pg-stat-label">Auto-fixable</div>
          <div className="pg-stat-value">3</div>
          <div className="pg-stat-delta pg-stat-up">via patch update</div>
        </div>
      </div>

      <div
        className="pg-card"
        style={{
          marginBottom: 16,
          background: 'var(--bg-danger-subtle)',
          borderColor: 'var(--fg-danger)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              1 high-severity vulnerability requires action
            </div>
            <div style={{ fontSize: 13, color: 'var(--fg-secondary)' }}>
              <span className="pg-mono">lodash@4.17.20</span> has a known Prototype Pollution
              vulnerability. Patch available: <span className="pg-mono">4.17.21</span>. AI can
              auto-create a CR.
            </div>
          </div>
          <button className="pg-btn pg-btn-primary pg-btn-sm">✦ Auto-create CR</button>
        </div>
      </div>

      <div className="pg-card" style={{ marginBottom: 16 }}>
        <div className="pg-card-header">
          <div className="pg-card-title">Open advisories</div>
        </div>
        {VULNS.map((v) => (
          <div
            key={v.id}
            style={{ padding: '16px 0', borderBottom: '1px solid var(--border-default)' }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  className={`pg-badge ${v.severity === 'high' ? 'pg-badge-danger' : v.severity === 'medium' ? 'pg-badge-warning' : 'pg-badge-default'}`}
                >
                  {v.severity.toUpperCase()} · CVSS {v.cvss}
                </span>
                <span className="pg-mono" style={{ fontSize: 11 }}>
                  {v.id}
                </span>
                <span className="pg-mono" style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}>
                  {v.cve}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="pg-btn pg-btn-ghost pg-btn-sm">Snooze</button>
                <button className="pg-btn pg-btn-secondary pg-btn-sm">Suppress</button>
                <button className="pg-btn pg-btn-primary pg-btn-sm">Auto-fix</button>
              </div>
            </div>
            <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>
              {v.type} in <span className="pg-mono">{v.pkg}</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--fg-secondary)', marginBottom: 8 }}>
              {v.desc}
            </div>
            <div className="pg-grid pg-grid-4" style={{ gap: 12, marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--fg-tertiary)' }}>Package</div>
                <div className="pg-mono" style={{ fontSize: 11 }}>
                  {v.pkg}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--fg-tertiary)' }}>Current</div>
                <div className="pg-mono" style={{ fontSize: 11, color: 'var(--fg-danger)' }}>
                  {v.current}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--fg-tertiary)' }}>Fixed in</div>
                <div className="pg-mono" style={{ fontSize: 11, color: 'var(--fg-success)' }}>
                  {v.fixed}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--fg-tertiary)' }}>Path</div>
                <div style={{ fontSize: 11 }}>{v.via}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--fg-tertiary)' }}>
              {v.exploitable ? (
                <span style={{ color: 'var(--fg-danger)' }}>⚠ Reachable in our code</span>
              ) : (
                <span>Not reachable in our code</span>
              )}
              <span>·</span>
              <span>Detected {v.age}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="pg-card">
        <div className="pg-card-header">
          <div className="pg-card-title">Ecosystems</div>
        </div>
        <div className="pg-table-wrap">
          <table className="pg-data-table">
            <thead>
              <tr>
                <th>Source</th>
                <th className="pg-tabular">Dependencies</th>
                <th className="pg-tabular">Vulnerabilities</th>
                <th>Last audit</th>
              </tr>
            </thead>
            <tbody>
              {ECOSYSTEM.map((e) => (
                <tr key={e.name}>
                  <td>{e.name}</td>
                  <td className="pg-tabular">{e.deps}</td>
                  <td className="pg-tabular">
                    {e.vulns > 0 ? (
                      <span style={{ color: 'var(--fg-warning)' }}>{e.vulns}</span>
                    ) : (
                      <span style={{ color: 'var(--fg-success)' }}>{e.vulns}</span>
                    )}
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}>{e.audited}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
