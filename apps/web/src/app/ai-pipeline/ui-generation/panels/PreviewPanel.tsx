'use client';

interface PreviewPanelProps {
  filePath: string;
}

export function PreviewPanel({ filePath }: PreviewPanelProps) {
  const componentName = filePath.split('/').pop()?.replace('.tsx', '') ?? '';

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
        <span className="text-xs font-medium text-muted-foreground">Live Preview</span>
        <div className="flex items-center gap-1">
          <button className="text-xs px-2 py-0.5 border border-border rounded text-muted-foreground hover:text-foreground">Desktop</button>
          <button className="text-xs px-2 py-0.5 border border-border rounded text-muted-foreground hover:text-foreground">Mobile</button>
        </div>
      </div>

      <div className="flex-1 bg-background overflow-hidden relative">
        {/* Simulated preview — in production this is a real iframe */}
        <div className="absolute inset-0 bg-white dark:bg-zinc-950 border-0 overflow-auto p-4">
          {componentName.includes('List') && <MockListPreview entityName={componentName.replace('ListPage', '').replace('sList', 's')} />}
          {componentName.includes('Detail') && <MockDetailPreview entityName={componentName.replace('DetailPage', '')} />}
          {componentName.includes('Dashboard') && <MockDashboardPreview />}
          {componentName.includes('SignIn') && <MockAuthPreview title="Sign In" />}
          {componentName.includes('AppShell') && <MockShellPreview />}
          {!['List', 'Detail', 'Dashboard', 'SignIn', 'AppShell'].some(k => componentName.includes(k)) && (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              Preview for {componentName}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MockListPreview({ entityName }: { entityName: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-base font-semibold text-zinc-900 dark:text-white">{entityName}</h1>
        <button className="px-3 py-1 bg-blue-600 text-white text-xs rounded">New {entityName.slice(0, -1)}</button>
      </div>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <th className="text-left py-1.5 text-zinc-500 font-medium">Name</th>
            <th className="text-left py-1.5 text-zinc-500 font-medium">Email</th>
            <th className="text-left py-1.5 text-zinc-500 font-medium">Created</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {['Alice Smith', 'Bob Jones', 'Carol White'].map((name, i) => (
            <tr key={i} className="border-b border-zinc-100 dark:border-zinc-900">
              <td className="py-1.5 text-zinc-900 dark:text-white">{name}</td>
              <td className="py-1.5 text-zinc-600 dark:text-zinc-400">{name.toLowerCase().replace(' ', '.')}@example.com</td>
              <td className="py-1.5 text-zinc-600 dark:text-zinc-400">Jan {i + 1}, 2024</td>
              <td className="py-1.5 text-right"><span className="text-blue-600 cursor-pointer text-xs">View</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MockDetailPreview({ entityName }: { entityName: string }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-zinc-500 cursor-pointer">← Back</span>
        <span className="text-xs text-zinc-400">/</span>
        <h1 className="text-base font-semibold text-zinc-900 dark:text-white">{entityName} Detail</h1>
      </div>
      <div className="space-y-2">
        {['Name', 'Email', 'Created At'].map(field => (
          <div key={field} className="flex gap-2 text-xs">
            <span className="w-20 text-zinc-500 flex-shrink-0">{field}</span>
            <span className="text-zinc-900 dark:text-white">Sample value</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockDashboardPreview() {
  return (
    <div>
      <h1 className="text-base font-semibold text-zinc-900 dark:text-white mb-3">Dashboard</h1>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {[['Contacts', '1,247'], ['Deals', '89']].map(([label, val]) => (
          <div key={label} className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-3">
            <p className="text-xs text-zinc-500">{label}</p>
            <p className="text-xl font-semibold text-zinc-900 dark:text-white">{val}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockAuthPreview({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center min-h-40">
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 w-64 space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white text-center">{title}</h2>
        <input className="w-full border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1.5 text-xs" placeholder="Email" />
        <input type="password" className="w-full border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1.5 text-xs" placeholder="Password" />
        <button className="w-full py-1.5 bg-blue-600 text-white text-xs rounded">{title}</button>
      </div>
    </div>
  );
}

function MockShellPreview() {
  return (
    <div className="flex h-40">
      <div className="w-32 bg-zinc-900 dark:bg-zinc-950 flex-shrink-0 p-2 space-y-1">
        {['Dashboard', 'Contacts', 'Deals', 'Settings'].map(item => (
          <div key={item} className={`px-2 py-1 text-xs rounded cursor-pointer ${item === 'Contacts' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'}`}>{item}</div>
        ))}
      </div>
      <div className="flex-1 bg-zinc-50 dark:bg-zinc-900 p-3">
        <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800 rounded mb-2" />
        <div className="h-2 w-48 bg-zinc-200 dark:bg-zinc-800 rounded" />
      </div>
    </div>
  );
}
