'use client';

import type { ReactNode } from 'react';

import { PanelLeftOpen } from 'lucide-react';
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

const COLLAPSED_KEY = 'lighthouse.contextNavCollapsed';

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [cmdkOpen, setCmdkOpen] = useState(false);
  // Read collapsed preference per-mode so collapsing AI Pipeline doesn't also
  // collapse Data Management, etc. Persisted to localStorage.
  const { contextNav, mode } = getShellConfig(pathname);
  const collapseKey = `${COLLAPSED_KEY}.${mode}`;
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem(collapseKey);
    setCollapsed(saved === '1');
  }, [collapseKey]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(collapseKey, next ? '1' : '0');
      }
      return next;
    });
  }, [collapseKey]);

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
      // ⌘ + . — toggle the context-nav rail when one is present.
      if ((e.metaKey || e.ctrlKey) && e.key === '.') {
        if (contextNav) {
          e.preventDefault();
          toggleCollapsed();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
    };
  }, [contextNav, toggleCollapsed]);

  const showContextNav = Boolean(contextNav) && !collapsed;

  return (
    <div
      className="grid overflow-hidden"
      style={{
        height: '100vh',
        gridTemplateRows: '44px 1fr',
        gridTemplateColumns: showContextNav ? '56px 240px 1fr' : '56px 1fr',
        gridTemplateAreas: showContextNav
          ? '"topbar topbar topbar" "iconnav contextnav main"'
          : '"topbar topbar" "iconnav main"',
        background: 'var(--background, #f9f9f9)',
        color: 'var(--foreground, #1a1a2e)',
        fontSize: '13px',
      }}
    >
      <Topbar onSearchOpen={openCmdk} />
      <IconNav />
      {showContextNav && contextNav && (
        <ContextNav config={contextNav} onCollapse={toggleCollapsed} />
      )}
      <main className="relative overflow-auto" id="main-content" style={{ gridArea: 'main' }}>
        {/*
         * When the side nav is collapsed, render a slim re-open tab pinned to
         * the left edge of the main area. This guarantees the user has a
         * visible way to bring the nav back even when the page content
         * occupies the whole area.
         */}
        {contextNav && collapsed && (
          <button
            type="button"
            onClick={toggleCollapsed}
            title="Show side nav (⌘.)"
            aria-label="Show side nav"
            style={{
              position: 'fixed',
              top: 60,
              left: 56,
              zIndex: 50,
              width: 22,
              height: 64,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--border, #e5e7eb)',
              borderLeft: 'none',
              borderRadius: '0 6px 6px 0',
              background: 'var(--card, #fff)',
              color: 'var(--muted-foreground, #6b7280)',
              cursor: 'pointer',
              boxShadow: '2px 0 6px rgba(0,0,0,0.08)',
            }}
          >
            <PanelLeftOpen style={{ width: 14, height: 14 }} />
          </button>
        )}
        {children}
      </main>
      <CommandPalette open={cmdkOpen} onClose={closeCmdk} />
    </div>
  );
}
