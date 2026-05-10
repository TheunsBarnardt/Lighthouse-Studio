'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { useActiveWorkspace } from '@/hooks/useActiveWorkspace';

function ChevronIcon(): JSX.Element {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

function CheckIcon(): JSX.Element {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 8l3.5 3.5L13 5" />
    </svg>
  );
}

export function WorkspaceSwitcher(): JSX.Element {
  const { active, workspaces, loading, setActiveBySlug } = useActiveWorkspace();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent): void {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener('mousedown', onClick);
      return () => document.removeEventListener('mousedown', onClick);
    }
    return undefined;
  }, [open]);

  const initials = active?.name
    ? active.name
        .split(/\s+/)
        .map((p) => p[0] ?? '')
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : '··';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-md border px-2 py-1 text-xs hover:bg-muted transition-colors h-7 max-w-[220px]"
        style={{ borderColor: 'var(--border-default, hsl(var(--color-border)))' }}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span
          className="flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold text-white shrink-0"
          style={{ background: 'hsl(var(--color-primary))' }}
          aria-hidden="true"
        >
          {initials}
        </span>
        <span className="truncate font-medium">
          {loading ? 'Loading…' : active?.name ?? 'No workspace'}
        </span>
        <ChevronIcon />
      </button>

      {open ? (
        <div
          className="absolute left-0 top-full z-40 mt-1 w-72 rounded-md border bg-card shadow-md"
          role="menu"
        >
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b">
            Workspaces
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {workspaces.length === 0 ? (
              <p className="px-3 py-3 text-xs text-muted-foreground">No workspaces yet.</p>
            ) : (
              workspaces.map((ws) => {
                const isActive = ws.id === active?.id;
                return (
                  <Link
                    key={ws.id}
                    href={`/workspaces/${ws.slug}`}
                    onClick={() => {
                      setActiveBySlug(ws.slug);
                      setOpen(false);
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted ${
                      isActive ? 'bg-muted/60' : ''
                    }`}
                    role="menuitem"
                  >
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold text-white shrink-0"
                      style={{ background: 'hsl(var(--color-primary))' }}
                      aria-hidden="true"
                    >
                      {ws.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="flex-1 min-w-0 truncate font-medium">{ws.name}</span>
                    <span className="text-[10px] text-muted-foreground font-mono truncate">{ws.slug}</span>
                    {isActive ? <CheckIcon /> : null}
                  </Link>
                );
              })
            )}
          </div>
          <div className="border-t py-1">
            <Link
              href="/workspaces"
              onClick={() => setOpen(false)}
              className="block px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              role="menuitem"
            >
              Manage workspaces…
            </Link>
            <Link
              href="/workspaces?new=1"
              onClick={() => setOpen(false)}
              className="block px-3 py-1.5 text-xs text-primary hover:bg-muted"
              role="menuitem"
            >
              + New workspace
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
