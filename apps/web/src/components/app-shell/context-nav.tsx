'use client';

import { PanelLeftClose } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import type { ContextNavConfig } from './shell-config';

interface ContextNavProps {
  config: ContextNavConfig;
  onCollapse?: () => void;
}

function ContextNavInner({ config, onCollapse }: ContextNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function isItemActive(href: string): boolean {
    // Split href into path + query
    const [hrefPath, hrefQuery] = href.split('?');
    const pathMatch =
      hrefPath === pathname ||
      Boolean(hrefPath !== '/' && hrefPath && pathname.startsWith(hrefPath));

    if (!hrefQuery) return pathMatch;

    // If there's a query string in the href, also check current search params match
    const hrefParams = new URLSearchParams(hrefQuery);
    for (const [key, val] of hrefParams.entries()) {
      if (searchParams.get(key) !== val) return false;
    }
    return pathMatch;
  }

  return (
    <nav
      className="flex flex-col overflow-y-auto border-r bg-white dark:bg-zinc-900"
      style={{
        gridArea: 'contextnav',
        borderColor: 'var(--border, #e5e7eb)',
      }}
      aria-label={config.title}
    >
      {/* Header */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-4 py-4 dark:bg-zinc-900"
        style={{ borderColor: 'var(--border, #e5e7eb)' }}
      >
        <p className="text-sm font-semibold" style={{ color: 'var(--foreground, #1a1a2e)' }}>
          {config.title}
        </p>
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            title="Collapse sidebar (⌘.)"
            aria-label="Collapse sidebar"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              borderRadius: 4,
              border: 'none',
              background: 'transparent',
              color: 'var(--muted-foreground, #6b7280)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <PanelLeftClose style={{ width: 14, height: 14 }} />
          </button>
        )}
      </div>

      {/* Action button */}
      {config.actionLabel && config.actionHref && (
        <div className="border-b px-3 py-2.5" style={{ borderColor: 'var(--border, #e5e7eb)' }}>
          <Link
            href={config.actionHref}
            className="flex w-full items-center justify-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium text-white no-underline transition-opacity hover:opacity-90 hover:no-underline"
            style={{ background: 'var(--primary, #3b6cf4)', borderRadius: '4px' }}
          >
            {config.actionLabel}
          </Link>
        </div>
      )}

      {/* Sections */}
      <div className="flex-1 p-2">
        {config.sections.map((section, sectionIdx) => (
          <div key={sectionIdx} className="mb-4">
            {section.heading && (
              <p
                className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--muted-foreground, #9ca3af)', letterSpacing: '0.06em' }}
              >
                {section.heading}
              </p>
            )}
            {section.items.map((item) => {
              const isActive = isItemActive(item.href);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-center gap-2.5 rounded px-2.5 py-1.5 text-[13px] no-underline transition-colors hover:no-underline"
                  style={{
                    borderRadius: '4px',
                    background: isActive ? 'var(--accent, #e8edfd)' : 'transparent',
                    color: isActive
                      ? 'var(--primary, #3b6cf4)'
                      : 'var(--muted-foreground, #6b7280)',
                    fontWeight: isActive ? 500 : 400,
                  }}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {item.icon && (
                    <span
                      className="flex h-3.5 w-3.5 items-center justify-center text-[12px]"
                      aria-hidden="true"
                    >
                      {item.icon}
                    </span>
                  )}
                  <span className="flex-1">{item.label}</span>
                  {item.badge !== undefined && (
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                      style={{
                        background: 'oklch(0.96 0.04 25)',
                        color: 'var(--destructive, #dc2626)',
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}

export function ContextNav(props: ContextNavProps) {
  return (
    <Suspense fallback={null}>
      <ContextNavInner {...props} />
    </Suspense>
  );
}

export { ContextNavInner };
