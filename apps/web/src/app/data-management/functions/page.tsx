import { Button } from '@/components/ui/button';

const FUNCTIONS = [
  {
    name: 'handle_new_user',
    args: '',
    returns: 'trigger',
    lang: 'plpgsql',
    volatility: 'volatile',
  },
  {
    name: 'get_pipeline_value',
    args: 'p_user_id uuid',
    returns: 'numeric',
    lang: 'sql',
    volatility: 'stable',
  },
  {
    name: 'recalc_deal_stages',
    args: '',
    returns: 'void',
    lang: 'plpgsql',
    volatility: 'volatile',
  },
  {
    name: 'notify_deal_won',
    args: 'p_deal_id uuid',
    returns: 'void',
    lang: 'plpgsql',
    volatility: 'volatile',
  },
  {
    name: 'contact_search',
    args: 'p_query text',
    returns: 'setof contacts',
    lang: 'sql',
    volatility: 'stable',
  },
  {
    name: 'days_in_stage',
    args: 'p_deal_id uuid',
    returns: 'integer',
    lang: 'sql',
    volatility: 'stable',
  },
  {
    name: 'cleanup_stale_sessions',
    args: '',
    returns: 'integer',
    lang: 'plpgsql',
    volatility: 'volatile',
  },
  {
    name: 'hash_audit_entry',
    args: 'p_payload jsonb',
    returns: 'text',
    lang: 'sql',
    volatility: 'immutable',
  },
];

export default function DatabaseFunctionsPage() {
  return (
    <div style={{ padding: '16px 24px' }}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Database Functions</h1>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            {FUNCTIONS.length} functions in public schema · PostgreSQL functions
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" type="button">
            + New function
          </Button>
        </div>
      </div>
      <div className="overflow-hidden rounded-md border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th>Name</th>
              <th>Arguments</th>
              <th>Returns</th>
              <th>Language</th>
              <th>Volatility</th>
            </tr>
          </thead>
          <tbody>
            {FUNCTIONS.map((fn) => (
              <tr key={fn.name} style={{ cursor: 'pointer' }}>
                <td>
                  <span className="font-mono text-sm" style={{ fontSize: 12 }}>
                    {fn.name}
                  </span>
                </td>
                <td>
                  <span className="font-mono text-sm" style={{ fontSize: 11 }}>
                    {fn.args || '—'}
                  </span>
                </td>
                <td>
                  <span className="font-mono text-sm" style={{ fontSize: 11 }}>
                    {fn.returns}
                  </span>
                </td>
                <td>
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {fn.lang}
                  </span>
                </td>
                <td style={{ fontSize: 12 }}>{fn.volatility}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
