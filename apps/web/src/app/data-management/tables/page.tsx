const TABLES = [
  { name: 'contacts', cols: 8, rows: '1,247', size: '4.2 MB' },
  { name: 'deals', cols: 9, rows: '342', size: '1.8 MB' },
  { name: 'activities', cols: 7, rows: '4,891', size: '12.4 MB' },
  { name: 'users', cols: 6, rows: '24', size: '128 KB' },
  { name: 'tags', cols: 3, rows: '18', size: '32 KB' },
  { name: 'contact_tags', cols: 2, rows: '847', size: '256 KB' },
  { name: 'audit_log', cols: 8, rows: '12,084', size: '48 MB' },
  { name: 'sessions', cols: 7, rows: '142', size: '512 KB' },
];

export default function DatabaseTablesPage() {
  return (
    <div style={{ padding: '16px 24px' }}>
      <div className="pg-page-header">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg-primary)', margin: 0 }}>
            Database Tables
          </h1>
          <div style={{ fontSize: 13, color: 'var(--fg-secondary)', marginTop: 4 }}>
            {TABLES.length} tables · public schema
          </div>
        </div>
        <div className="pg-page-header-actions">
          <select
            style={{
              border: '1px solid var(--border-default)',
              borderRadius: 4,
              background: 'var(--bg-surface)',
              color: 'var(--fg-secondary)',
              fontSize: 12,
              padding: '3px 8px',
              height: 28,
            }}
          >
            <option>schema: public</option>
          </select>
          <input
            placeholder="Search for a table"
            style={{
              border: '1px solid var(--border-default)',
              borderRadius: 4,
              background: 'var(--bg-surface)',
              color: 'var(--fg-primary)',
              fontSize: 12,
              padding: '3px 8px',
              height: 28,
              width: 200,
              outline: 'none',
            }}
          />
          <button className="pg-btn pg-btn-primary pg-btn-sm" type="button">
            + New table
          </button>
        </div>
      </div>
      <div className="pg-table-wrap">
        <table className="pg-data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th className="pg-tabular">Columns</th>
              <th className="pg-tabular">Rows (est.)</th>
              <th className="pg-tabular">Size (est.)</th>
              <th>Realtime</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {TABLES.map((t) => (
              <tr key={t.name} style={{ cursor: 'pointer' }}>
                <td>
                  <span className="pg-mono" style={{ fontSize: 12 }}>
                    <span style={{ color: 'var(--fg-tertiary)', marginRight: 6 }}>▦</span>
                    {t.name}
                  </span>
                </td>
                <td className="pg-tabular" style={{ color: 'var(--fg-secondary)' }}>
                  {t.cols}
                </td>
                <td className="pg-tabular" style={{ color: 'var(--fg-secondary)' }}>
                  {t.rows}
                </td>
                <td className="pg-tabular" style={{ color: 'var(--fg-tertiary)' }}>
                  {t.size}
                </td>
                <td style={{ color: 'var(--fg-tertiary)', fontSize: 12 }}>✕ Disabled</td>
                <td>
                  <button className="pg-btn pg-btn-secondary pg-btn-xs" type="button">
                    View columns
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
