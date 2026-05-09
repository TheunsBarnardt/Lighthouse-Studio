import { Button } from '@/components/ui/button';

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
  return value ? <span>✓</span> : <span>✗</span>;
}

export default function PublicationsPage() {
  return (
    <div style={{ padding: '16px 24px' }}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Publications</h1>
          <div style={{ fontSize: 13, marginTop: 4 }}>Logical replication publications</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" type="button">
            + New publication
          </Button>
        </div>
      </div>
      <div className="overflow-hidden rounded-md border">
        <table className="w-full border-collapse text-sm">
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
                  <span className="font-mono text-sm">{pub.name}</span>
                </td>
                <td>{pub.tables}</td>
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
