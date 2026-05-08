'use client';

const FUNCTIONS = [
  {
    name: 'updateDealStage',
    type: 'HTTP',
    status: 'active',
    invocations: 1247,
    p95: '12ms',
    deployed: '5 min ago',
  },
  {
    name: 'searchContacts',
    type: 'HTTP',
    status: 'active',
    invocations: 8432,
    p95: '8ms',
    deployed: '5 min ago',
  },
  {
    name: 'exportDealsCSV',
    type: 'HTTP',
    status: 'active',
    invocations: 23,
    p95: '420ms',
    deployed: '5 min ago',
  },
  {
    name: 'nightlyDealStaleness',
    type: 'Scheduled',
    status: 'active',
    invocations: 1,
    p95: '1.8s',
    deployed: '5 min ago',
  },
  {
    name: 'onContactCreated',
    type: 'Event',
    status: 'active',
    invocations: 147,
    p95: '34ms',
    deployed: '5 min ago',
  },
  {
    name: 'onDealWon',
    type: 'Event',
    status: 'active',
    invocations: 8,
    p95: '89ms',
    deployed: '5 min ago',
  },
  {
    name: 'outlookCalendarSync',
    type: 'Integration',
    status: 'active',
    invocations: 412,
    p95: '247ms',
    deployed: '2 days ago',
  },
];

export default function EdgeFunctionsPage() {
  return (
    <div style={{ padding: '16px 24px' }}>
      <div className="pg-page-header">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg-primary)', margin: 0 }}>
            Edge Functions
          </h1>
          <div style={{ fontSize: 13, color: 'var(--fg-secondary)', marginTop: 4 }}>
            {FUNCTIONS.length} functions · sandboxed Node 22 · permission-declared
          </div>
        </div>
        <div className="pg-page-header-actions">
          <button className="pg-btn pg-btn-primary pg-btn-sm">+ New function</button>
        </div>
      </div>

      <div className="pg-table-wrap" style={{ marginBottom: 24 }}>
        <table className="pg-data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Status</th>
              <th className="pg-tabular">Invocations 24h</th>
              <th className="pg-tabular">p95</th>
              <th>Last deployed</th>
            </tr>
          </thead>
          <tbody>
            {FUNCTIONS.map((fn) => (
              <tr key={fn.name} style={{ cursor: 'pointer' }}>
                <td className="pg-mono" style={{ fontSize: 12 }}>
                  {fn.name}
                </td>
                <td>
                  <span className="pg-badge pg-badge-default">{fn.type}</span>
                </td>
                <td>
                  <span className="pg-badge pg-badge-success">Active</span>
                </td>
                <td className="pg-tabular">{fn.invocations.toLocaleString()}</td>
                <td className="pg-tabular" style={{ color: 'var(--fg-secondary)' }}>
                  {fn.p95}
                </td>
                <td style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}>{fn.deployed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pg-grid pg-grid-3">
        <div className="pg-card">
          <div className="pg-card-header">
            <div className="pg-card-title">Sandbox limits</div>
          </div>
          <div className="pg-inspector-row">
            <span className="pg-inspector-key">Default timeout</span>
            <span className="pg-inspector-val pg-tabular">30s</span>
          </div>
          <div className="pg-inspector-row">
            <span className="pg-inspector-key">Default memory</span>
            <span className="pg-inspector-val pg-tabular">256MB</span>
          </div>
          <div className="pg-inspector-row">
            <span className="pg-inspector-key">Network</span>
            <span className="pg-inspector-val">declared egress only</span>
          </div>
        </div>
        <div className="pg-card">
          <div className="pg-card-header">
            <div className="pg-card-title">Static analysis</div>
          </div>
          <div className="pg-inspector-row">
            <span className="pg-inspector-key">eval / Function()</span>
            <span className="pg-inspector-val" style={{ color: 'var(--fg-success)' }}>
              ✓ none
            </span>
          </div>
          <div className="pg-inspector-row">
            <span className="pg-inspector-key">child_process</span>
            <span className="pg-inspector-val" style={{ color: 'var(--fg-success)' }}>
              ✓ none
            </span>
          </div>
          <div className="pg-inspector-row">
            <span className="pg-inspector-key">fs/net direct</span>
            <span className="pg-inspector-val" style={{ color: 'var(--fg-success)' }}>
              ✓ none
            </span>
          </div>
        </div>
        <div className="pg-card">
          <div className="pg-card-header">
            <div className="pg-card-title">Runtime</div>
          </div>
          <div className="pg-inspector-row">
            <span className="pg-inspector-key">Engine</span>
            <span className="pg-inspector-val">Node 22 LTS</span>
          </div>
          <div className="pg-inspector-row">
            <span className="pg-inspector-key">Pool</span>
            <span className="pg-inspector-val">isolated workers</span>
          </div>
          <div className="pg-inspector-row">
            <span className="pg-inspector-key">Cold start</span>
            <span className="pg-inspector-val pg-tabular">~120ms p95</span>
          </div>
        </div>
      </div>
    </div>
  );
}
