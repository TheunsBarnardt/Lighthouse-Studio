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
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Query Performance</h1>
          <div style={{ fontSize: 13, marginTop: 4 }}>Top queries by total time · last 7 days</div>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th>Query</th>
              <th className="tabular-nums">Calls</th>
              <th className="tabular-nums">Total</th>
              <th className="tabular-nums">Mean</th>
              <th className="tabular-nums">p95</th>
            </tr>
          </thead>
          <tbody>
            {QUERIES.map((q) => (
              <tr key={q.sql}>
                <td
                  className="font-mono text-sm"
                  style={{
                    fontSize: 11,
                    maxWidth: 400,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {q.sql}
                </td>
                <td className="tabular-nums">{q.calls.toLocaleString()}</td>
                <td className="tabular-nums">{q.total}</td>
                <td className="tabular-nums">{q.mean}</td>
                <td className="tabular-nums">{q.p95}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
