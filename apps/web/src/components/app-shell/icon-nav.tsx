'use client';

import type { LucideIcon } from 'lucide-react';

import {
  Activity,
  Blocks as BlocksIcon,
  CheckCircle,
  CircleUser,
  Globe,
  HardDrive,
  Home,
  Lightbulb,
  Network,
  Radio,
  Settings2,
  Sparkles,
  Table2,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  id: string;
  icon: LucideIcon;
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
  { id: 'home', icon: Home, tooltip: 'Home', href: '/' },
  {
    id: 'ai-pipeline',
    icon: Sparkles,
    tooltip: 'AI Pipeline',
    href: '/ai-pipeline/intent-capture',
  },
  { id: 'blocks', icon: BlocksIcon, tooltip: 'Blocks library', href: '/blocks' },
  { id: 'approvals', icon: CheckCircle, tooltip: 'Approvals', href: '/approvals', dot: true },
  { divider: true },
  { id: 'table-editor', icon: Table2, tooltip: 'Table Editor', href: '/data-management' },
  { id: 'designer', icon: Network, tooltip: 'Schema Designer', href: '/schema-designer' },
  { id: 'storage', icon: HardDrive, tooltip: 'Storage', href: '/storage' },
  { id: 'edge-functions', icon: Zap, tooltip: 'Edge Functions', href: '/edge-functions' },
  { id: 'realtime', icon: Radio, tooltip: 'Realtime', href: '/realtime' },
  { id: 'apis', icon: Globe, tooltip: 'APIs', href: '/apis/rest' },
  { divider: true },
  { id: 'observability', icon: Activity, tooltip: 'Observability', href: '/metrics' },
  { id: 'advisors', icon: Lightbulb, tooltip: 'Advisors', href: '/advisors', dot: true },
  { divider: true },
  { id: 'settings', icon: Settings2, tooltip: 'Workspaces & Settings', href: '/workspaces' },
  { spacer: true },
  { id: 'account', icon: CircleUser, tooltip: 'Account', href: '/account/profile' },
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
  if (pathname.startsWith('/blocks')) return 'blocks';
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
        const Icon = item.icon;
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
            <Icon size={18} strokeWidth={1.6} />
          </Link>
        );
      })}
    </nav>
  );
}
