import type { ReactNode } from 'react';

import Link from 'next/link';

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const NAV = [
    { href: `/workspaces/${slug}/members`, label: 'Members' },
    { href: `/workspaces/${slug}/invitations`, label: 'Invitations' },
    { href: `/workspaces/${slug}/roles`, label: 'Roles' },
    { href: `/workspaces/${slug}/branding`, label: 'Branding' },
    { href: `/workspaces/${slug}/email-templates`, label: 'Email templates' },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav className="mb-6 flex gap-4 border-b pb-3">
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
      {children}
    </div>
  );
}
