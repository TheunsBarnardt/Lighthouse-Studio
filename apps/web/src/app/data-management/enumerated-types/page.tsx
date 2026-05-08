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
      <div className="pg-page-header">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg-primary)', margin: 0 }}>
            Enumerated Types
          </h1>
          <div style={{ fontSize: 13, color: 'var(--fg-secondary)', marginTop: 4 }}>
            {ENUM_TYPES.length} enums in public schema
          </div>
        </div>
        <div className="pg-page-header-actions">
          <button className="pg-btn pg-btn-primary pg-btn-sm" type="button">
            + New type
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {ENUM_TYPES.map((type) => (
          <div key={type.name} className="pg-card" style={{ padding: '12px 16px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <strong className="pg-mono" style={{ color: 'var(--fg-primary)' }}>
                {type.name}
              </strong>
              <button className="pg-btn pg-btn-ghost pg-btn-xs" type="button">
                Edit
              </button>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {type.values.map((v) => (
                <span key={v} className="pg-badge pg-badge-default pg-mono">
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
