'use client';

import type { ReactNode } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useAuth } from '@/context/auth-context';

interface NavLink {
  href: string;
  label: string;
  /** When true, only show if the user has a builtin (password) identity */
  requiresPassword?: boolean;
}

const NAV_LINKS: NavLink[] = [
  { href: '/account/profile', label: 'Profile' },
  { href: '/account/password', label: 'Password', requiresPassword: true },
  { href: '/account/email', label: 'Email' },
  { href: '/account/mfa', label: 'Two-factor auth', requiresPassword: true },
  { href: '/account/sessions', label: 'Active sessions' },
  { href: '/account/identities', label: 'Linked accounts' },
  { href: '/account/preferences', label: 'Preferences' },
  { href: '/account/danger-zone', label: 'Danger zone' },
];

export default function AccountLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();

  const hasBuiltinIdentity = user?.identities.some((i) => i.providerId === 'builtin') ?? true;

  const visibleLinks = NAV_LINKS.filter((link) => !link.requiresPassword || hasBuiltinIdentity);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-8 text-2xl font-bold">Account settings</h1>
      <div className="flex gap-8">
        <nav aria-label="Account settings navigation" className="w-48 shrink-0">
          <ul className="space-y-1">
            {visibleLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`block rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${
                    pathname === link.href
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground'
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
