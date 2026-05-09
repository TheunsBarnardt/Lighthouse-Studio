const EXTENSIONS = [
  { name: 'uuid-ossp', version: '1.1', status: 'enabled', description: 'Generate UUIDs' },
  { name: 'pgcrypto', version: '1.3', status: 'enabled', description: 'Cryptographic functions' },
  {
    name: 'pg_stat_statements',
    version: '1.10',
    status: 'enabled',
    description: 'Track planning and execution statistics',
  },
  {
    name: 'pgvector',
    version: '0.7.0',
    status: 'enabled',
    description: 'Vector similarity search for embeddings',
  },
  {
    name: 'pg_trgm',
    version: '1.6',
    status: 'enabled',
    description: 'Trigram-based fuzzy text search',
  },
  {
    name: 'btree_gin',
    version: '1.3',
    status: 'available',
    description: 'GIN indexes on btree-indexable types',
  },
  {
    name: 'postgis',
    version: '3.4',
    status: 'available',
    description: 'Spatial and geographic objects',
  },
  {
    name: 'hstore',
    version: '1.8',
    status: 'available',
    description: 'Key-value pair storage type',
  },
  {
    name: 'plpgsql',
    version: '1.0',
    status: 'enabled',
    description: 'PL/pgSQL procedural language',
  },
  {
    name: 'ltree',
    version: '1.2',
    status: 'available',
    description: 'Hierarchical tree-like structures',
  },
];

const enabledCount = EXTENSIONS.filter((e) => e.status === 'enabled').length;
const availableCount = EXTENSIONS.filter((e) => e.status === 'available').length;

export default function DatabaseExtensionsPage() {
  return (
    <div style={{ padding: '16px 24px' }}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Extensions</h1>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            {enabledCount} enabled · {availableCount} available
          </div>
        </div>
      </div>
      <div className="overflow-hidden rounded-md border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th>Name</th>
              <th>Version</th>
              <th>Description</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {EXTENSIONS.map((ext) => (
              <tr key={ext.name}>
                <td>
                  <span className="font-mono text-sm" style={{ fontSize: 12 }}>
                    {ext.name}
                  </span>
                </td>
                <td className="tabular-nums" style={{ fontSize: 11 }}>
                  {ext.version}
                </td>
                <td style={{ fontSize: 12 }}>{ext.description}</td>
                <td>
                  {ext.status === 'enabled' ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      Enabled
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      Available
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
