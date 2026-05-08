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
      <div className="pg-page-header">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg-primary)', margin: 0 }}>
            Indexes
          </h1>
          <div style={{ fontSize: 13, color: 'var(--fg-secondary)', marginTop: 4 }}>
            {INDEXES.length} indexes across {TABLE_COUNT} tables
          </div>
        </div>
        <div className="pg-page-header-actions">
          <button className="pg-btn pg-btn-primary pg-btn-sm" type="button">
            + New index
          </button>
        </div>
      </div>
      <div className="pg-table-wrap">
        <table className="pg-data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Table</th>
              <th>Type</th>
              <th>Columns</th>
              <th className="pg-tabular">Size</th>
            </tr>
          </thead>
          <tbody>
            {INDEXES.map((idx) => (
              <tr key={idx.name}>
                <td>
                  <span className="pg-mono" style={{ fontSize: 12 }}>
                    {idx.name}
                  </span>
                </td>
                <td>
                  <span className="pg-mono" style={{ fontSize: 11, color: 'var(--fg-secondary)' }}>
                    {idx.table}
                  </span>
                </td>
                <td>
                  <span className="pg-badge pg-badge-default">{idx.type}</span>
                </td>
                <td>
                  <span className="pg-mono" style={{ fontSize: 11, color: 'var(--fg-secondary)' }}>
                    {idx.columns}
                  </span>
                </td>
                <td className="pg-tabular" style={{ fontSize: 11, color: 'var(--fg-secondary)' }}>
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
