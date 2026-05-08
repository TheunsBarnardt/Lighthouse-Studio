'use client';

const QUERIES = [
  {
    sql: 'SELECT * FROM contacts WHERE company = $1',
    calls: 14823,
    total: '4m 22s',
    mean: '17.7ms',
    p95: '124ms',
  },
  {
    sql: 'SELECT * FROM deals WHERE stage IN (...)',
    calls: 8421,
    total: '2m 11s',
    mean: '15.6ms',
    p95: '89ms',
  },
  {
    sql: 'UPDATE deals SET stage = $1 WHERE id = $2',
    calls: 1247,
    total: '1m 04s',
    mean: '51.3ms',
    p95: '218ms',
  },
  {
    sql: 'INSERT INTO audit_log VALUES (...)',
    calls: 24711,
    total: '47s',
    mean: '1.9ms',
    p95: '8ms',
  },
];

export default function QueryPerformancePage() {
  return (
    <div style={{ padding: '16px 24px' }}>
      <div className="pg-page-header">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg-primary)', margin: 0 }}>
            Query Performance
          </h1>
          <div style={{ fontSize: 13, color: 'var(--fg-secondary)', marginTop: 4 }}>
            Top queries by total time · last 7 days
          </div>
        </div>
      </div>

      <div className="pg-table-wrap">
        <table className="pg-data-table">
          <thead>
            <tr>
              <th>Query</th>
              <th className="pg-tabular">Calls</th>
              <th className="pg-tabular">Total</th>
              <th className="pg-tabular">Mean</th>
              <th className="pg-tabular">p95</th>
            </tr>
          </thead>
          <tbody>
            {QUERIES.map((q) => (
              <tr key={q.sql}>
                <td
                  className="pg-mono"
                  style={{
                    fontSize: 11,
                    maxWidth: 400,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {q.sql}
                </td>
                <td className="pg-tabular">{q.calls.toLocaleString()}</td>
                <td className="pg-tabular">{q.total}</td>
                <td className="pg-tabular">{q.mean}</td>
                <td className="pg-tabular" style={{ color: 'var(--fg-warning)' }}>
                  {q.p95}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
