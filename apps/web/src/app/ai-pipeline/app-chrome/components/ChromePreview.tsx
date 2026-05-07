'use client';

interface RegionConfig {
  blockId: string;
  params: Record<string, unknown>;
}

interface ChromeState {
  layout: 'sidenav-with-topbar' | 'topnav-only';
  header?: RegionConfig;
  sidenav?: RegionConfig;
  breadcrumb?: RegionConfig;
  footer?: RegionConfig;
}

function ChromeLockBadge({ label }: { label: string }) {
  return (
    <div className="absolute top-1 right-1 flex items-center gap-1 px-1.5 py-0.5 bg-black/60 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
      <span>🔒</span>
      <span>Configured in App Chrome ↗</span>
      <span className="text-white/60">{label}</span>
    </div>
  );
}

function MockHeader({ config }: { config?: RegionConfig }) {
  const productName = (config?.params.productName as string) ?? 'My App';
  const showSearch = config?.params.showSearch !== false;
  const isMarketing = config?.blockId === 'chrome-header-marketing';
  const isMinimal = config?.blockId === 'chrome-header-minimal';

  return (
    <div className="relative group flex items-center justify-between px-4 h-11 bg-zinc-900 text-white flex-shrink-0 border-b border-zinc-800">
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 bg-blue-500 rounded-sm flex items-center justify-center text-white text-xs font-bold">
          {productName[0]}
        </div>
        <span className="text-sm font-semibold">{productName}</span>
        {isMarketing && (
          <div className="flex gap-3 ml-4">
            {['Features', 'Pricing', 'Docs'].map(n => (
              <span key={n} className="text-xs text-zinc-300">{n}</span>
            ))}
          </div>
        )}
      </div>
      {!isMinimal && (
        <div className="flex items-center gap-3">
          {showSearch && !isMarketing && (
            <div className="h-6 w-36 bg-zinc-800 rounded text-xs text-zinc-500 flex items-center px-2">Search…</div>
          )}
          {isMarketing ? (
            <div className="h-6 px-3 bg-blue-600 rounded text-xs text-white flex items-center">Get started</div>
          ) : (
            <div className="w-6 h-6 bg-zinc-700 rounded-full" />
          )}
        </div>
      )}
      <ChromeLockBadge label={config?.blockId ?? 'none'} />
    </div>
  );
}

function MockSidenav({ config }: { config?: RegionConfig }) {
  const isIconOnly = config?.blockId === 'chrome-sidenav-icon-only';

  return (
    <div className={`relative group bg-zinc-900 border-r border-zinc-800 flex-shrink-0 ${isIconOnly ? 'w-10' : 'w-44'} flex flex-col py-2`}>
      {['Dashboard', 'Contacts', 'Deals', 'Settings'].map((item, i) => (
        <div key={item} className={`flex items-center gap-2 px-2 py-1.5 text-xs rounded mx-1 mb-0.5 ${i === 1 ? 'bg-blue-600 text-white' : 'text-zinc-400'}`}>
          <div className={`w-4 h-4 rounded-sm flex items-center justify-center text-xs ${i === 1 ? 'bg-blue-500' : 'bg-zinc-800'}`}>
            {['◼', '👤', '💼', '⚙'][i]}
          </div>
          {!isIconOnly && <span>{item}</span>}
        </div>
      ))}
      <ChromeLockBadge label={config?.blockId ?? 'none'} />
    </div>
  );
}

function MockBreadcrumb({ config }: { config?: RegionConfig }) {
  const sep = (config?.params.separator as string) ?? '/';
  const isTabbed = config?.blockId === 'chrome-breadcrumb-tabbed';

  return (
    <div className="relative group border-b border-zinc-200 dark:border-zinc-800 px-3 py-1.5 flex items-center gap-1.5 flex-shrink-0 bg-background">
      <span className="text-xs text-muted-foreground">Contacts</span>
      <span className="text-xs text-zinc-400">{sep}</span>
      <span className="text-xs font-medium text-foreground">Alice Smith</span>
      {isTabbed && (
        <div className="ml-4 flex gap-3 border-l border-border pl-4">
          {['Overview', 'Timeline', 'Deals'].map((t, i) => (
            <span key={t} className={`text-xs pb-0.5 ${i === 0 ? 'text-primary border-b border-primary font-medium' : 'text-muted-foreground'}`}>{t}</span>
          ))}
        </div>
      )}
      <ChromeLockBadge label={config?.blockId ?? 'none'} />
    </div>
  );
}

function MockFooter({ config }: { config?: RegionConfig }) {
  const productName = (config?.params.productName as string) ?? 'My App';
  const isStandard = config?.blockId === 'chrome-footer-standard';

  return (
    <div className="relative group border-t border-zinc-200 dark:border-zinc-800 px-4 py-2 flex-shrink-0 bg-background">
      {isStandard ? (
        <div className="flex justify-between items-start">
          <div className="grid grid-cols-3 gap-6 text-xs text-muted-foreground">
            {['Product', 'Company', 'Legal'].map(col => (
              <div key={col}>
                <p className="font-medium text-foreground mb-1">{col}</p>
                <div className="space-y-0.5">
                  <p>Link 1</p>
                  <p>Link 2</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">© 2026 {productName}</p>
        </div>
      ) : (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>© 2026 {productName}</span>
          <div className="flex gap-4">
            <span>Privacy</span>
            <span>Terms</span>
          </div>
        </div>
      )}
      <ChromeLockBadge label={config?.blockId ?? 'none'} />
    </div>
  );
}

export function ChromePreview({ chrome }: { chrome: ChromeState }) {
  const showSidenav = chrome.layout === 'sidenav-with-topbar' && !!chrome.sidenav;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-foreground">Preview</p>
        <p className="text-xs text-muted-foreground">Hover chrome regions to see the lock indicator</p>
      </div>

      <div className="border border-border rounded-lg overflow-hidden shadow-sm" style={{ height: 420 }}>
        <div className="flex flex-col h-full">
          {chrome.header && <MockHeader config={chrome.header} />}

          <div className="flex flex-1 overflow-hidden">
            {showSidenav && <MockSidenav config={chrome.sidenav} />}

            <div className="flex-1 flex flex-col overflow-hidden">
              {chrome.breadcrumb && <MockBreadcrumb config={chrome.breadcrumb} />}

              <div className="flex-1 bg-muted/30 p-4">
                <div className="h-3 w-40 bg-zinc-200 dark:bg-zinc-800 rounded mb-2" />
                <div className="h-2 w-64 bg-zinc-200 dark:bg-zinc-800 rounded mb-4" />
                <div className="grid grid-cols-2 gap-3">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-16 bg-background border border-border rounded-md" />
                  ))}
                </div>
              </div>

              {chrome.footer && <MockFooter config={chrome.footer} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
