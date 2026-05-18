'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

interface CmdkItem {
  group: string;
  label: string;
  href: string;
}

const CMDK_ITEMS: CmdkItem[] = [
  { group: 'Navigation', label: 'Home', href: '/' },
  { group: 'AI Pipeline', label: 'AI Pipeline overview', href: '/ai-pipeline' },
  { group: 'AI Pipeline', label: 'Stage 1 Â· Intent capture', href: '/ai-pipeline/intent-capture' },
  {
    group: 'AI Pipeline',
    label: 'Stage 2 Â· Requirements (PRD)',
    href: '/ai-pipeline/prd-generation',
  },
  { group: 'AI Pipeline', label: 'Stage 3 Â· UI generation', href: '/ai-pipeline/ui-generation' },
  {
    group: 'AI Pipeline',
    label: 'Stage 4 Â· Schema synthesis',
    href: '/ai-pipeline/schema-synthesis',
  },
  { group: 'AI Pipeline', label: 'Stage 5 Â· Data migration', href: '/ai-pipeline/data-migration' },
  {
    group: 'AI Pipeline',
    label: 'Stage 6 Â· Code generation',
    href: '/ai-pipeline/code-generation',
  },
  { group: 'AI Pipeline', label: 'Stage 7 Â· Tests', href: '/ai-pipeline/test-generation' },
  { group: 'AI Pipeline', label: 'Stage 8 Â· Deployment', href: '/ai-pipeline/deployment' },
  { group: 'Blocks', label: 'Blocks library', href: '/blocks' },
  {
    group: 'Operations',
    label: 'Change requests',
    href: '/operations/change-requests',
  },
  { group: 'Observability', label: 'Signals', href: '/observability/signals' },
  { group: 'Observability', label: 'Outcome tracking', href: '/observability/outcomes' },
  { group: 'Data', label: 'Table Editor', href: '/data-management' },
  { group: 'Data', label: 'Schema Designer', href: '/schema-designer' },
  { group: 'Data', label: 'Storage', href: '/storage' },
  { group: 'Workspace', label: 'Workspaces', href: '/workspaces' },
  { group: 'Account', label: 'Profile', href: '/account/profile' },
  { group: 'Account', label: 'Password', href: '/account/password' },
  { group: 'Account', label: 'Two-factor auth', href: '/account/mfa' },
  { group: 'Account', label: 'Active sessions', href: '/account/sessions' },
  { group: 'Admin', label: 'Admin Â· Users', href: '/admin/users' },
  { group: 'Admin', label: 'Admin Â· Workspaces', href: '/admin/workspaces' },
  { group: 'Admin', label: 'Admin Â· Audit log', href: '/admin/audit' },
];

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
    };
  }, [open, onClose]);

  const filtered = query
    ? CMDK_ITEMS.filter((i) => i.label.toLowerCase().includes(query.toLowerCase()))
    : CMDK_ITEMS;

  const grouped = filtered.reduce<Record<string, CmdkItem[]>>((acc, item) => {
    (acc[item.group] ??= []).push(item);
    return acc;
  }, {});

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[700] flex items-start justify-center bg-black/50 pt-[100px]"
      onClick={handleOverlayClick}
      role="dialog"
      aria-label="Command palette"
    >
      <div className="w-[640px] max-w-[calc(100vw-32px)] overflow-hidden rounded-lg border border-border bg-card shadow-lg">
        <input
          ref={inputRef}
          type="text"
          className="w-full border-0 border-b border-border bg-card px-[18px] py-3.5 text-sm text-foreground outline-none"
          placeholder="Type a command or search..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
          aria-label="Search"
        />
        <div className="max-h-[400px] overflow-y-auto p-1.5" role="listbox">
          {Object.entries(grouped).length === 0 ? (
            <div className="p-4 text-[13px] text-muted-foreground">No results</div>
          ) : (
            Object.entries(grouped).map(([group, items]) => (
              <div key={group}>
                <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                  {group}
                </div>
                {items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-2.5 rounded px-3 py-2 text-[13px] text-foreground no-underline hover:bg-accent hover:text-primary"
                    role="option"
                    aria-selected={false}
                    onClick={onClose}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
