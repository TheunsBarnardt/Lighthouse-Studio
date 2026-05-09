'use client';

import { Button } from '@/components/ui/button';

const FUNCTIONS = [
  {
    name: 'updateDealStage',
    type: 'HTTP',
    status: 'active',
    invocations: 1247,
    p95: '12ms',
    deployed: '5 min ago',
  },
  {
    name: 'searchContacts',
    type: 'HTTP',
    status: 'active',
    invocations: 8432,
    p95: '8ms',
    deployed: '5 min ago',
  },
  {
    name: 'exportDealsCSV',
    type: 'HTTP',
    status: 'active',
    invocations: 23,
    p95: '420ms',
    deployed: '5 min ago',
  },
  {
    name: 'nightlyDealStaleness',
    type: 'Scheduled',
    status: 'active',
    invocations: 1,
    p95: '1.8s',
    deployed: '5 min ago',
  },
  {
    name: 'onContactCreated',
    type: 'Event',
    status: 'active',
    invocations: 147,
    p95: '34ms',
    deployed: '5 min ago',
  },
  {
    name: 'onDealWon',
    type: 'Event',
    status: 'active',
    invocations: 8,
    p95: '89ms',
    deployed: '5 min ago',
  },
  {
    name: 'outlookCalendarSync',
    type: 'Integration',
    status: 'active',
    invocations: 412,
    p95: '247ms',
    deployed: '2 days ago',
  },
];

export default function EdgeFunctionsPage() {
  return (
    <div style={{ padding: '16px 24px' }}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Edge Functions</h1>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            {FUNCTIONS.length} functions · sandboxed Node 22 · permission-declared
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" type="button">
            + New function
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border" style={{ marginBottom: 24 }}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Status</th>
              <th className="tabular-nums">Invocations 24h</th>
              <th className="tabular-nums">p95</th>
              <th>Last deployed</th>
            </tr>
          </thead>
          <tbody>
            {FUNCTIONS.map((fn) => (
              <tr key={fn.name} style={{ cursor: 'pointer' }}>
                <td className="font-mono text-sm" style={{ fontSize: 12 }}>
                  {fn.name}
                </td>
                <td>
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {fn.type}
                  </span>
                </td>
                <td>
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                    Active
                  </span>
                </td>
                <td className="tabular-nums">{fn.invocations.toLocaleString()}</td>
                <td className="tabular-nums">{fn.p95}</td>
                <td style={{ fontSize: 11 }}>{fn.deployed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-md border bg-card text-card-foreground p-4">
          <div className="mb-3 flex items-center justify-between border-b pb-3">
            <div className="text-sm font-semibold">Sandbox limits</div>
          </div>
          <div className="flex items-center justify-between border-b py-1.5 text-sm last:border-b-0">
            <span className="text-muted-foreground">Default timeout</span>
            <span className="font-medium tabular-nums">30s</span>
          </div>
          <div className="flex items-center justify-between border-b py-1.5 text-sm last:border-b-0">
            <span className="text-muted-foreground">Default memory</span>
            <span className="font-medium tabular-nums">256MB</span>
          </div>
          <div className="flex items-center justify-between border-b py-1.5 text-sm last:border-b-0">
            <span className="text-muted-foreground">Network</span>
            <span className="font-medium">declared egress only</span>
          </div>
        </div>
        <div className="rounded-md border bg-card text-card-foreground p-4">
          <div className="mb-3 flex items-center justify-between border-b pb-3">
            <div className="text-sm font-semibold">Static analysis</div>
          </div>
          <div className="flex items-center justify-between border-b py-1.5 text-sm last:border-b-0">
            <span className="text-muted-foreground">eval / Function()</span>
            <span className="font-medium">✓ none</span>
          </div>
          <div className="flex items-center justify-between border-b py-1.5 text-sm last:border-b-0">
            <span className="text-muted-foreground">child_process</span>
            <span className="font-medium">✓ none</span>
          </div>
          <div className="flex items-center justify-between border-b py-1.5 text-sm last:border-b-0">
            <span className="text-muted-foreground">fs/net direct</span>
            <span className="font-medium">✓ none</span>
          </div>
        </div>
        <div className="rounded-md border bg-card text-card-foreground p-4">
          <div className="mb-3 flex items-center justify-between border-b pb-3">
            <div className="text-sm font-semibold">Runtime</div>
          </div>
          <div className="flex items-center justify-between border-b py-1.5 text-sm last:border-b-0">
            <span className="text-muted-foreground">Engine</span>
            <span className="font-medium">Node 22 LTS</span>
          </div>
          <div className="flex items-center justify-between border-b py-1.5 text-sm last:border-b-0">
            <span className="text-muted-foreground">Pool</span>
            <span className="font-medium">isolated workers</span>
          </div>
          <div className="flex items-center justify-between border-b py-1.5 text-sm last:border-b-0">
            <span className="text-muted-foreground">Cold start</span>
            <span className="font-medium tabular-nums">~120ms p95</span>
          </div>
        </div>
      </div>
    </div>
  );
}
