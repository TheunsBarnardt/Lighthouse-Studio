interface Publication {
  name: string;
  tables: string;
  insert: boolean;
  update: boolean;
  delete: boolean;
}

const PUBLICATIONS: Publication[] = [
  {
    name: 'platform_realtime',
    tables: 'all tables',
    insert: true,
    update: true,
    delete: true,
  },
  {
    name: 'platform_replication',
    tables: 'contacts, deals, activities',
    insert: true,
    update: true,
    delete: true,
  },
];

function Check({ value }: { value: boolean }) {
  return value ? (
    <span style={{ color: 'var(--fg-success)' }}>✓</span>
  ) : (
    <span style={{ color: 'var(--fg-tertiary)' }}>✗</span>
  );
}

export default function PublicationsPage() {
  return (
    <div style={{ padding: '16px 24px' }}>
      <div className="pg-page-header">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg-primary)', margin: 0 }}>
            Publications
          </h1>
          <div style={{ fontSize: 13, color: 'var(--fg-secondary)', marginTop: 4 }}>
            Logical replication publications
          </div>
        </div>
        <div className="pg-page-header-actions">
          <button className="pg-btn pg-btn-primary pg-btn-sm" type="button">
            + New publication
          </button>
        </div>
      </div>
      <div className="pg-table-wrap">
        <table className="pg-data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Tables</th>
              <th>Insert</th>
              <th>Update</th>
              <th>Delete</th>
            </tr>
          </thead>
          <tbody>
            {PUBLICATIONS.map((pub) => (
              <tr key={pub.name}>
                <td>
                  <span className="pg-mono">{pub.name}</span>
                </td>
                <td style={{ color: 'var(--fg-secondary)' }}>{pub.tables}</td>
                <td>
                  <Check value={pub.insert} />
                </td>
                <td>
                  <Check value={pub.update} />
                </td>
                <td>
                  <Check value={pub.delete} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
