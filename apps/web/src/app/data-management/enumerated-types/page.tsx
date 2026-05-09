import { Button } from '@/components/ui/button';

interface EnumType {
  name: string;
  values: string[];
}

const ENUM_TYPES: EnumType[] = [
  {
    name: 'deal_stage',
    values: ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'],
  },
  {
    name: 'user_role',
    values: ['workspace_owner', 'admin', 'member', 'viewer'],
  },
  {
    name: 'activity_type',
    values: ['call', 'email', 'meeting', 'note', 'task'],
  },
  {
    name: 'notification_status',
    values: ['pending', 'sent', 'delivered', 'failed'],
  },
];

export default function EnumeratedTypesPage() {
  return (
    <div style={{ padding: '16px 24px' }}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Enumerated Types</h1>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            {ENUM_TYPES.length} enums in public schema
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" type="button">
            + New type
          </Button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {ENUM_TYPES.map((type) => (
          <div
            key={type.name}
            className="rounded-md border bg-card text-card-foreground p-4"
            style={{ padding: '12px 16px' }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <strong className="font-mono text-sm">{type.name}</strong>
              <Button className="" variant="ghost" type="button">
                Edit
              </Button>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {type.values.map((v) => (
                <span
                  key={v}
                  className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground font-mono text-sm"
                >
                  {v}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
