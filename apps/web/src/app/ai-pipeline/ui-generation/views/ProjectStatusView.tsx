'use client';

interface ProjectStatusViewProps {
  totalComponents: number;
  approvedCount: number;
  onApproveAll: () => void;
}

const COMPONENT_LIST = [
  { name: 'AppShell.tsx', type: 'Shell', status: 'approved' },
  { name: 'Navigation.tsx', type: 'Shell', status: 'approved' },
  { name: 'SignInPage.tsx', type: 'Auth', status: 'approved' },
  { name: 'SignUpPage.tsx', type: 'Auth', status: 'draft' },
  { name: 'DashboardPage.tsx', type: 'Page', status: 'approved' },
  { name: 'ContactsListPage.tsx', type: 'Page', status: 'draft' },
  { name: 'ContactDetailPage.tsx', type: 'Page', status: 'approved' },
  { name: 'ContactCreatePage.tsx', type: 'Page', status: 'draft' },
  { name: 'DealsListPage.tsx', type: 'Page', status: 'draft' },
  { name: 'DealDetailPage.tsx', type: 'Page', status: 'draft' },
  { name: 'router.tsx', type: 'Config', status: 'approved' },
  { name: 'package.json', type: 'Config', status: 'approved' },
] as const;

type Status = 'approved' | 'draft' | 'issue';

function StatusBadge({ status }: { status: Status }) {
  if (status === 'approved') {
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Approved</span>;
  }
  if (status === 'issue') {
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Issue</span>;
  }
  return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">Draft</span>;
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs border border-border text-muted-foreground">
      {type}
    </span>
  );
}

export function ProjectStatusView({ totalComponents, approvedCount, onApproveAll }: ProjectStatusViewProps) {
  const pct = Math.round((approvedCount / totalComponents) * 100);
  const allApproved = approvedCount === totalComponents;

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-4">Project Status</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="border border-border rounded-lg p-4 text-center">
              <p className="text-2xl font-semibold text-foreground">{approvedCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Approved</p>
            </div>
            <div className="border border-border rounded-lg p-4 text-center">
              <p className="text-2xl font-semibold text-foreground">{totalComponents - approvedCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Pending</p>
            </div>
            <div className="border border-border rounded-lg p-4 text-center">
              <p className="text-2xl font-semibold text-foreground">{pct}%</p>
              <p className="text-xs text-muted-foreground mt-1">Complete</p>
            </div>
          </div>
          <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Components</h3>
            {!allApproved && (
              <button
                onClick={onApproveAll}
                className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
              >
                Approve All
              </button>
            )}
          </div>

          <div className="border border-border rounded-lg divide-y divide-border overflow-hidden">
            {COMPONENT_LIST.map(comp => (
              <div key={comp.name} className="flex items-center gap-3 px-4 py-3 bg-background hover:bg-muted/20">
                <span className="flex-1 text-xs font-mono text-foreground">{comp.name}</span>
                <TypeBadge type={comp.type} />
                <StatusBadge status={comp.status as Status} />
              </div>
            ))}
          </div>
        </div>

        <div className="border border-border rounded-lg p-4 space-y-2">
          <h3 className="text-xs font-semibold text-foreground">Quality Signals</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              ['TypeScript', 'No errors'],
              ['Accessibility', '11/12 pass'],
              ['Design tokens', 'All used'],
              ['Permission checks', 'Present in all CRUD'],
              ['Storybook stories', '12/12 generated'],
              ['TanStack Query', 'All list/detail pages'],
            ].map(([label, val]) => (
              <div key={label} className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{label}</span>
                <span className="text-foreground font-medium">{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
