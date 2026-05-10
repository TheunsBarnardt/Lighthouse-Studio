'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  id: string;
  icon: string;
  tooltip: string;
  href: string;
  dot?: boolean;
}

interface Divider {
  divider: true;
}
interface Spacer {
  spacer: true;
}
type NavEntry = NavItem | Divider | Spacer;

const ICON_NAV: NavEntry[] = [
  { id: 'home', icon: 'âŒ‚', tooltip: 'Home', href: '/' },
  { id: 'ai-pipeline', icon: 'âœ¦', tooltip: 'AI Pipeline', href: '/ai-pipeline/intent-capture' },
  { id: 'approvals', icon: 'âœ“', tooltip: 'Approvals', href: '/approvals', dot: true },
  { divider: true },
  { id: 'table-editor', icon: 'â–¦', tooltip: 'Table Editor', href: '/data-management' },
  { id: 'designer', icon: 'â—°', tooltip: 'Schema Designer', href: '/schema-designer' },
  { id: 'storage', icon: 'âŠž', tooltip: 'Storage', href: '/storage' },
  { id: 'edge-functions', icon: 'âŒ¥', tooltip: 'Edge Functions', href: '/edge-functions' },
  { id: 'realtime', icon: 'âŸ³', tooltip: 'Realtime', href: '/realtime' },
  { id: 'apis', icon: 'â‡Œ', tooltip: 'APIs', href: '/apis/rest' },
  { divider: true },
  { id: 'observability', icon: 'â—‰', tooltip: 'Observability', href: '/metrics' },
  { id: 'advisors', icon: 'â—', tooltip: 'Advisors', href: '/advisors', dot: true },
  { divider: true },
  { id: 'settings', icon: 'âš™', tooltip: 'Workspaces & Settings', href: '/workspaces' },
  { spacer: true },
  { id: 'account', icon: 'â—¯', tooltip: 'Account', href: '/account/profile' },
];

function isDivider(item: NavEntry): item is Divider {
  return 'divider' in item;
}
function isSpacer(item: NavEntry): item is Spacer {
  return 'spacer' in item;
}

function getMode(pathname: string): string {
  if (pathname === '/') return 'home';
  if (pathname.startsWith('/ai-pipeline')) return 'ai-pipeline';
  if (pathname.startsWith('/data-management')) return 'table-editor';
  if (pathname.startsWith('/schema-designer')) return 'designer';
  if (pathname.startsWith('/storage')) return 'storage';
  if (pathname.startsWith('/approvals')) return 'approvals';
  if (pathname.startsWith('/edge-functions')) return 'edge-functions';
  if (pathname.startsWith('/realtime')) return 'realtime';
  if (pathname.startsWith('/apis')) return 'apis';
  if (
    pathname.startsWith('/logs') ||
    pathname.startsWith('/metrics') ||
    pathname.startsWith('/traces') ||
    pathname.startsWith('/alerts') ||
    pathname.startsWith('/uptime')
  )
    return 'observability';
  if (pathname.startsWith('/advisors')) return 'advisors';
  if (
    pathname.startsWith('/workspaces') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/backups')
  )
    return 'settings';
  if (pathname.startsWith('/account') || pathname.startsWith('/admin')) return 'account';
  return '';
}

export function IconNav() {
  const pathname = usePathname();
  const activeMode = getMode(pathname);

  return (
    <nav
      className="flex flex-col overflow-hidden border-r bg-white py-2 dark:bg-zinc-900"
      style={{
        gridArea: 'iconnav',
        borderColor: 'var(--border, #e5e7eb)',
        gap: '2px',
      }}
      aria-label="Primary navigation"
    >
      {ICON_NAV.map((item, i) => {
        if (isDivider(item)) {
          return (
            <div
              key={`divider-${String(i)}`}
              role="separator"
              className="mx-3 my-1.5"
              style={{ height: '1px', background: 'var(--border, #e5e7eb)' }}
            />
          );
        }
        if (isSpacer(item)) {
          return <div key={`spacer-${String(i)}`} className="flex-1" aria-hidden="true" />;
        }

        const isActive = item.id === activeMode;
        return (
          <Link
            key={item.id}
            href={item.href}
            className="relative mx-2 flex h-9 w-10 items-center justify-center rounded text-base no-underline transition-colors hover:no-underline"
            style={{
              borderRadius: '4px',
              background: isActive ? 'var(--accent, #e8edfd)' : 'transparent',
              color: isActive ? 'var(--primary, #3b6cf4)' : 'var(--muted-foreground, #6b7280)',
            }}
            title={item.tooltip}
            aria-label={item.tooltip}
            aria-current={isActive ? 'page' : undefined}
          >
            {isActive && (
              <span
                className="absolute -left-2 top-1.5 bottom-1.5 w-0.5 rounded-r"
                style={{ background: 'var(--primary, #3b6cf4)' }}
              />
            )}
            {item.dot && !isActive && (
              <span
                className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full"
                style={{ background: 'oklch(0.55 0.15 75)' }}
              />
            )}
            {item.icon}
          </Link>
        );
      })}
    </nav>
  );
}
