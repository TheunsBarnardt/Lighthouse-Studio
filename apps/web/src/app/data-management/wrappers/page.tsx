interface FdwWrapper {
  name: string;
  status: 'connected' | 'available';
}

const WRAPPERS: FdwWrapper[] = [
  { name: 'Stripe', status: 'connected' },
  { name: 'Firebase', status: 'available' },
  { name: 'BigQuery', status: 'available' },
  { name: 'ClickHouse', status: 'available' },
  { name: 'MSSQL', status: 'available' },
  { name: 'MongoDB', status: 'available' },
];

export default function WrappersPage() {
  return (
    <div style={{ padding: '16px 24px' }}>
      <div className="pg-page-header">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg-primary)', margin: 0 }}>
            Foreign Data Wrappers
          </h1>
          <div style={{ fontSize: 13, color: 'var(--fg-secondary)', marginTop: 4 }}>
            Connect external sources as foreign tables
          </div>
        </div>
        <div className="pg-page-header-actions">
          <button className="pg-btn pg-btn-primary pg-btn-sm" type="button">
            + New wrapper
          </button>
        </div>
      </div>

      <div className="pg-grid pg-grid-3">
        {WRAPPERS.map((w) => (
          <div key={w.name} className="pg-card" style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ color: 'var(--fg-primary)' }}>{w.name}</strong>
              {w.status === 'connected' ? (
                <span className="pg-badge pg-badge-success">Connected</span>
              ) : (
                <span className="pg-badge pg-badge-default">Available</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
