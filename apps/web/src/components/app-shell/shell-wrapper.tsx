'use client';

import type { ReactNode } from 'react';

import { usePathname } from 'next/navigation';

import { AppShell } from './shell';

const NO_SHELL_PREFIXES = ['/auth', '/api', '/setup'];
const NO_SHELL_EXACT = new Set(['/']);

interface ShellWrapperProps {
  children: ReactNode;
}

export function ShellWrapper({ children }: ShellWrapperProps) {
  const pathname = usePathname();
  const showShell =
    !NO_SHELL_EXACT.has(pathname) && !NO_SHELL_PREFIXES.some((p) => pathname.startsWith(p));

  if (!showShell) return <>{children}</>;
  return <AppShell>{children}</AppShell>;
}
