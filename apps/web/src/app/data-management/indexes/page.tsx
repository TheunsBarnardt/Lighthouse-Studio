import { Button } from '@/components/ui/button';

const INDEXES = [
  { name: 'contacts_pkey', table: 'contacts', type: 'btree', columns: '(id)', size: '128 kB' },
  {
    name: 'contacts_email_idx',
    table: 'contacts',
    type: 'btree',
    columns: '(email)',
    size: '96 kB',
  },
  {
    name: 'contacts_company_idx',
    table: 'contacts',
    type: 'btree',
    columns: '(company)',
    size: '64 kB',
  },
  { name: 'deals_pkey', table: 'deals', type: 'btree', columns: '(id)', size: '32 kB' },
  {
    name: 'deals_contact_id_idx',
    table: 'deals',
    type: 'btree',
    columns: '(contact_id)',
    size: '24 kB',
  },
  { name: 'deals_stage_idx', table: 'deals', type: 'btree', columns: '(stage)', size: '16 kB' },
  {
    name: 'deals_owner_id_idx',
    table: 'deals',
    type: 'btree',
    columns: '(owner_id)',
    size: '24 kB',
  },
  {
    name: 'activities_deal_id_idx',
    table: 'activities',
    type: 'btree',
    columns: '(deal_id)',
    size: '16 kB',
  },
  { name: 'audit_log_pkey', table: 'audit_log', type: 'btree', columns: '(id)', size: '256 kB' },
  {
    name: 'audit_log_actor_id_idx',
    table: 'audit_log',
    type: 'btree',
    columns: '(actor_id)',
    size: '128 kB',
  },
];

const TABLE_COUNT = [...new Set(INDEXES.map((i) => i.table))].length;

export default function DatabaseIndexesPage() {
  return (
    <div style={{ padding: '16px 24px' }}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Indexes</h1>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            {INDEXES.length} indexes across {TABLE_COUNT} tables
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" type="button">
            + New index
          </Button>
        </div>
      </div>
      <div className="overflow-hidden rounded-md border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th>Name</th>
              <th>Table</th>
              <th>Type</th>
              <th>Columns</th>
              <th className="tabular-nums">Size</th>
            </tr>
          </thead>
          <tbody>
            {INDEXES.map((idx) => (
              <tr key={idx.name}>
                <td>
                  <span className="font-mono text-sm" style={{ fontSize: 12 }}>
                    {idx.name}
                  </span>
                </td>
                <td>
                  <span className="font-mono text-sm" style={{ fontSize: 11 }}>
                    {idx.table}
                  </span>
                </td>
                <td>
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {idx.type}
                  </span>
                </td>
                <td>
                  <span className="font-mono text-sm" style={{ fontSize: 11 }}>
                    {idx.columns}
                  </span>
                </td>
                <td className="tabular-nums" style={{ fontSize: 11 }}>
                  {idx.size}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
