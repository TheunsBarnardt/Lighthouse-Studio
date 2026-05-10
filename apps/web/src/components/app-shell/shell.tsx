'use client';

import type { ReactNode } from 'react';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { CommandPalette } from './command-palette';
import { ContextNav } from './context-nav';
import { IconNav } from './icon-nav';
import { getShellConfig } from './shell-config';
import { Topbar } from './topbar';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [cmdkOpen, setCmdkOpen] = useState(false);

  const { contextNav } = getShellConfig(pathname);

  const openCmdk = useCallback(() => {
    setCmdkOpen(true);
  }, []);
  const closeCmdk = useCallback(() => {
    setCmdkOpen(false);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdkOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
    };
  }, []);

  return (
    <div
      className="grid overflow-hidden"
      style={{
        height: '100vh',
        gridTemplateRows: '44px 1fr',
        gridTemplateColumns: contextNav ? '56px 240px 1fr' : '56px 1fr',
        gridTemplateAreas: contextNav
          ? '"topbar topbar topbar" "iconnav contextnav main"'
          : '"topbar topbar" "iconnav main"',
        background: 'var(--background, #f9f9f9)',
        color: 'var(--foreground, #1a1a2e)',
        fontSize: '13px',
      }}
    >
      <Topbar onSearchOpen={openCmdk} />
      <IconNav />
      {contextNav && <ContextNav config={contextNav} />}
      <main className="overflow-auto" id="main-content" style={{ gridArea: 'main' }}>
        {children}
      </main>
      <CommandPalette open={cmdkOpen} onClose={closeCmdk} />
    </div>
  );
}
