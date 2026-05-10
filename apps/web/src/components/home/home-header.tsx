'use client';

import type React from 'react';
import Link from 'next/link';
import { useCallback } from 'react';

import { useTheme } from '@/components/theme-provider';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';

function MoonIcon(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M14 9.5A6.5 6.5 0 0 1 6.5 2a6.5 6.5 0 1 0 7.5 7.5z" />
    </svg>
  );
}

function SunIcon(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M8 1v2M8 13v2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M1 8h2M13 8h2M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4" />
      <circle cx="8" cy="8" r="3" />
    </svg>
  );
}

export function HomeHeader(): React.JSX.Element {
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useAuth();

  const toggle = useCallback(() => setTheme(theme === 'light' ? 'dark' : 'light'), [theme, setTheme]);

  const initials = user?.displayName
    ? user.displayName
        .split(/\s+/)
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : (user?.email.charAt(0).toUpperCase() ?? '?');

  return (
    <header className="border-b">
      <div className="mx-auto max-w-[1280px] flex items-center gap-3 px-6 h-14">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold no-underline">
          <span
            className="flex h-6 w-6 items-center justify-center rounded text-[11px] font-bold text-white"
            style={{ background: 'hsl(var(--color-primary))' }}
            aria-hidden="true"
          >
            L
          </span>
          <span>Lighthouse Studio</span>
        </Link>

        <div className="flex-1" />

        <Link href="/workspaces" className="text-xs text-muted-foreground hover:text-foreground">
          Workspaces
        </Link>
        <Link href="/ai-pipeline" className="text-xs text-muted-foreground hover:text-foreground">
          Projects
        </Link>

        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggle} aria-label="Toggle theme">
          {theme === 'light' ? <MoonIcon /> : <SunIcon />}
        </Button>

        <Link
          href="/account/profile"
          className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted transition-colors"
          aria-label={`Account: ${user?.displayName ?? user?.email ?? 'Profile'}`}
        >
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold"
            style={{
              background: 'hsl(var(--color-primary) / 0.15)',
              color: 'hsl(var(--color-primary))',
            }}
            aria-hidden="true"
          >
            {initials}
          </span>
        </Link>

        <Button variant="ghost" size="sm" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
    </header>
  );
}
