import { Button } from '@/components/ui/button';

export default function DatabasePoliciesPage() {
  return (
    <div style={{ padding: '16px 24px' }}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>RLS Policies</h1>
          <div style={{ fontSize: 13, marginTop: 4 }}>Defense-in-depth row-level security</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" type="button">
            + New policy
          </Button>
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
          background: 'oklch(0.97 0.05 75)',
          marginBottom: 24,
          fontSize: 13,
        }}
      >
        <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>âš </span>
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
          fontSize: 13,
          border: '1px dashed var(--border)',
          borderRadius: 8,
        }}
      >
        <p style={{ margin: '0 0 4px' }}>No policies yet. Create one to start.</p>
        <p style={{ margin: '0 0 16px', fontSize: 12 }}>
          Policies restrict which rows a role can read, insert, update, or delete.
        </p>
        <Button variant="outline" size="sm" type="button">
          Create first policy
        </Button>
      </div>
    </div>
  );
}
