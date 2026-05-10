import { Button } from '@/components/ui/button';

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
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Database Tables</h1>
          <div style={{ fontSize: 13, marginTop: 4 }}>{TABLES.length} tables Â· public schema</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <select
            style={{
              border: '1px solid var(--border)',
              borderRadius: 4,
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
              border: '1px solid var(--border)',
              borderRadius: 4,
              fontSize: 12,
              padding: '3px 8px',
              height: 28,
              width: 200,
              outline: 'none',
            }}
          />
          <Button size="sm" type="button">
            + New table
          </Button>
        </div>
      </div>
      <div className="overflow-hidden rounded-md border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th>Name</th>
              <th className="tabular-nums">Columns</th>
              <th className="tabular-nums">Rows (est.)</th>
              <th className="tabular-nums">Size (est.)</th>
              <th>Realtime</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {TABLES.map((t) => (
              <tr key={t.name} style={{ cursor: 'pointer' }}>
                <td>
                  <span className="font-mono text-sm" style={{ fontSize: 12 }}>
                    <span style={{ marginRight: 6 }}>â–¦</span>
                    {t.name}
                  </span>
                </td>
                <td className="tabular-nums">{t.cols}</td>
                <td className="tabular-nums">{t.rows}</td>
                <td className="tabular-nums">{t.size}</td>
                <td style={{ fontSize: 12 }}>âœ• Disabled</td>
                <td>
                  <Button variant="outline" size="xs" type="button">
                    View columns
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
