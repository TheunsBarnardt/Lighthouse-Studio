'use client';

import Link from 'next/link';
import { useCallback } from 'react';

import { useTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/auth-context';

interface TopbarProps {
  onSearchOpen?: () => void;
}

function MoonIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="M14 9.5A6.5 6.5 0 0 1 6.5 2a6.5 6.5 0 1 0 7.5 7.5z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="M8 1v2M8 13v2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M1 8h2M13 8h2M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4" />
      <circle cx="8" cy="8" r="3" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="M3 6.5a5 5 0 0 1 10 0V10l1 2H2l1-2V6.5zM6 13a2 2 0 0 0 4 0" />
    </svg>
  );
}

function ConnectIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <circle cx="4" cy="4" r="2" />
      <circle cx="12" cy="4" r="2" />
      <circle cx="4" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <path d="M6 4h4M4 6v4M12 6v4M6 12h4" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <circle cx="6.5" cy="6.5" r="4.5" />
      <path d="M10.5 10.5L14 14" />
    </svg>
  );
}

export function Topbar({ onSearchOpen }: TopbarProps) {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  }, [theme, setTheme]);

  const initials = user?.displayName
    ? user.displayName
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user?.email
      ? user.email.charAt(0).toUpperCase() || '?'
      : '?';

  return (
    <header
      className="flex items-center gap-3 border-b bg-white px-3 dark:bg-zinc-900"
      style={{ gridArea: 'topbar', borderColor: 'var(--border, #e5e7eb)' }}
    >
      {/* Logo */}
      <Link
        href="/"
        className="flex items-center gap-2 text-sm font-semibold no-underline hover:no-underline"
        style={{ color: 'var(--foreground, #1a1a2e)' }}
        aria-label="Lighthouse Studio home"
      >
        <span
          className="flex h-[22px] w-[22px] items-center justify-center rounded text-[11px] font-bold text-white"
          style={{ background: 'var(--primary, #3b6cf4)', borderRadius: '4px' }}
          aria-hidden="true"
        >
          L
        </span>
        <span className="hidden sm:inline">Lighthouse Studio</span>
      </Link>

      {/* Connect */}
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 text-xs"
        onClick={() => {}}
        aria-label="Connection details"
      >
        <ConnectIcon />
        Connect
      </Button>

      <div className="flex-1" />

      {/* Search */}
      <button
        type="button"
        className="flex w-[220px] items-center gap-2 rounded border px-2.5 py-1 text-xs"
        style={{
          borderColor: 'var(--border, #e5e7eb)',
          color: 'var(--muted-foreground, #9ca3af)',
          background: 'transparent',
        }}
        onClick={onSearchOpen}
        aria-label="Open command palette (âŒ˜K)"
      >
        <SearchIcon />
        <span>Search...</span>
        <kbd
          className="ml-auto rounded border px-1 text-[10px]"
          style={{
            borderColor: 'var(--border, #e5e7eb)',
            color: 'var(--muted-foreground, #6b7280)',
            background: 'var(--muted, #f9fafb)',
          }}
          aria-hidden="true"
        >
          âŒ˜K
        </kbd>
      </button>

      {/* Action icons */}
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? <MoonIcon /> : <SunIcon />}
        </Button>

        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Notifications">
          <BellIcon />
        </Button>

        <Link
          href="/account/profile"
          className="ml-1 flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Account: ${user?.displayName ?? user?.email ?? 'Profile'}`}
        >
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold"
            style={{
              background: 'var(--primary, #e8edfd)',
              color: 'var(--primary, #3b6cf4)',
            }}
            aria-hidden="true"
          >
            {initials}
          </span>
        </Link>
      </div>
    </header>
  );
}
