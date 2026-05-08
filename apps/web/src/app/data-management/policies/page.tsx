export default function DatabasePoliciesPage() {
  return (
    <div style={{ padding: '16px 24px' }}>
      <div className="pg-page-header">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg-primary)', margin: 0 }}>
            RLS Policies
          </h1>
          <div style={{ fontSize: 13, color: 'var(--fg-secondary)', marginTop: 4 }}>
            Defense-in-depth row-level security
          </div>
        </div>
        <div className="pg-page-header-actions">
          <button className="pg-btn pg-btn-primary pg-btn-sm" type="button">
            + New policy
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
          padding: '10px 14px',
          borderRadius: 6,
          border: '1px solid oklch(0.45 0.14 75 / 0.4)',
          background: 'var(--bg-warning-subtle)',
          marginBottom: 24,
          fontSize: 13,
          color: 'var(--fg-primary)',
        }}
      >
        <span style={{ color: 'var(--fg-warning)', fontSize: 15, flexShrink: 0, marginTop: 1 }}>
          ⚠
        </span>
        <p style={{ margin: 0 }}>
          <strong>22 tables have RLS disabled.</strong> Service-layer authorization is in place;
          DB-level RLS is recommended as defense in depth. Enable it per-table to restrict direct
          database access.
        </p>
      </div>

      <div
        style={{
          textAlign: 'center',
          padding: '48px 24px',
          color: 'var(--fg-tertiary)',
          fontSize: 13,
          border: '1px dashed var(--border-default)',
          borderRadius: 8,
        }}
      >
        <p style={{ margin: '0 0 4px' }}>No policies yet. Create one to start.</p>
        <p style={{ margin: '0 0 16px', fontSize: 12, color: 'var(--fg-tertiary)' }}>
          Policies restrict which rows a role can read, insert, update, or delete.
        </p>
        <button className="pg-btn pg-btn-secondary pg-btn-sm" type="button">
          Create first policy
        </button>
      </div>
    </div>
  );
}
