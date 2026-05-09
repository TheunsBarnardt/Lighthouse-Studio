import { Button } from '@/components/ui/button';

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
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Foreign Data Wrappers</h1>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            Connect external sources as foreign tables
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" type="button">
            + New wrapper
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {WRAPPERS.map((w) => (
          <div
            key={w.name}
            className="rounded-md border bg-card text-card-foreground p-4"
            style={{ padding: '12px 16px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>{w.name}</strong>
              {w.status === 'connected' ? (
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                  Connected
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  Available
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
