import type { ReactNode } from 'react';

import Link from 'next/link';
import { redirect } from 'next/navigation';

import { isInstallationAdmin } from '@/lib/server/auth-service';
import { verifySessionFromCookies } from '@/lib/server/session';

const NAV = [
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/workspaces', label: 'Workspaces' },
  { href: '/admin/audit', label: 'Audit log' },
  { href: '/admin/upgrade', label: 'Upgrade' },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await verifySessionFromCookies();
  if (!session || !isInstallationAdmin(session.userId)) {
    redirect('/');
  }
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Installation admin
        </h2>
        <nav className="mt-2 flex gap-4 border-b pb-3">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-muted-foreground hover:text-primary"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
