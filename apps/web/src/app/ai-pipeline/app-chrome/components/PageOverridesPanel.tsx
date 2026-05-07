'use client';

type Layout = 'sidenav-with-topbar' | 'topnav-only';

const PAGES = [
  { id: 'sign-in', path: '/sign-in', label: 'Sign In' },
  { id: 'sign-up', path: '/sign-up', label: 'Sign Up' },
  { id: 'forgot-password', path: '/forgot-password', label: 'Forgot Password' },
  { id: 'dashboard', path: '/dashboard', label: 'Dashboard' },
  { id: 'contacts', path: '/contacts', label: 'Contacts List' },
  { id: 'contact-detail', path: '/contacts/:id', label: 'Contact Detail' },
  { id: 'deals', path: '/deals', label: 'Deals List' },
];

const AUTH_PAGES = ['sign-in', 'sign-up', 'forgot-password'];

interface PageOverridesPanelProps {
  layout: Layout;
}

export function PageOverridesPanel({ layout }: PageOverridesPanelProps) {
  return (
    <div className="p-4 space-y-3">
      <p className="text-xs text-muted-foreground">
        Override chrome regions for specific pages. Auth pages default to hiding the side nav.
      </p>

      <div className="space-y-1">
        {PAGES.map(page => {
          const isAuth = AUTH_PAGES.includes(page.id);
          return (
            <div key={page.id} className="border border-border rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-foreground">{page.label}</p>
                  <p className="text-xs font-mono text-muted-foreground">{page.path}</p>
                </div>
                {isAuth && (
                  <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded">
                    Auth
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="text-xs text-muted-foreground">Layout</label>
                  <select
                    defaultValue={isAuth ? 'topnav-only' : layout}
                    className="w-full text-xs border border-border rounded px-1.5 py-1 bg-background text-foreground mt-0.5"
                  >
                    <option value={layout}>Default ({layout})</option>
                    <option value="sidenav-with-topbar">Side nav + Top bar</option>
                    <option value="topnav-only">Top nav only</option>
                    <option value="full-page">Full page (no chrome)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Side Nav</label>
                  <select
                    defaultValue={isAuth ? 'none' : 'default'}
                    className="w-full text-xs border border-border rounded px-1.5 py-1 bg-background text-foreground mt-0.5"
                  >
                    <option value="default">Default</option>
                    <option value="none">None</option>
                  </select>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
