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
  { group: 'AI Pipeline', label: 'Stage 1 · Intent capture', href: '/ai-pipeline/intent-capture' },
  {
    group: 'AI Pipeline',
    label: 'Stage 2 · Requirements (PRD)',
    href: '/ai-pipeline/prd-generation',
  },
  { group: 'AI Pipeline', label: 'Stage 3 · Design tokens', href: '/ai-pipeline/design-tokens' },
  {
    group: 'AI Pipeline',
    label: 'Stage 4 · Schema synthesis',
    href: '/ai-pipeline/schema-synthesis',
  },
  { group: 'AI Pipeline', label: 'Stage 5 · Data migration', href: '/ai-pipeline/data-migration' },
  { group: 'AI Pipeline', label: 'Stage 6 · UI generation', href: '/ai-pipeline/ui-generation' },
  {
    group: 'AI Pipeline',
    label: 'Stage 7 · Code generation',
    href: '/ai-pipeline/code-generation',
  },
  { group: 'AI Pipeline', label: 'Stage 8 · Tests', href: '/ai-pipeline/test-generation' },
  { group: 'AI Pipeline', label: 'Stage 9 · Deployment', href: '/ai-pipeline/deployment' },
  { group: 'AI Pipeline', label: 'Stage 10 · Maintenance', href: '/ai-pipeline/maintenance' },
  { group: 'Data', label: 'Table Editor', href: '/data-management' },
  { group: 'Data', label: 'Schema Designer', href: '/schema-designer' },
  { group: 'Data', label: 'Storage', href: '/storage' },
  { group: 'Workspace', label: 'Workspaces', href: '/workspaces' },
  { group: 'Account', label: 'Profile', href: '/account/profile' },
  { group: 'Account', label: 'Password', href: '/account/password' },
  { group: 'Account', label: 'Two-factor auth', href: '/account/mfa' },
  { group: 'Account', label: 'Active sessions', href: '/account/sessions' },
  { group: 'Admin', label: 'Admin · Users', href: '/admin/users' },
  { group: 'Admin', label: 'Admin · Workspaces', href: '/admin/workspaces' },
  { group: 'Admin', label: 'Admin · Audit log', href: '/admin/audit' },
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
      className="shell-cmdk-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-label="Command palette"
    >
      <div className="shell-cmdk">
        <input
          ref={inputRef}
          type="text"
          className="shell-cmdk-input"
          placeholder="Type a command or search..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
          aria-label="Search"
        />
        <div className="shell-cmdk-results" role="listbox">
          {Object.entries(grouped).length === 0 ? (
            <div style={{ padding: '16px', color: 'var(--fg-tertiary)', fontSize: '13px' }}>
              No results
            </div>
          ) : (
            Object.entries(grouped).map(([group, items]) => (
              <div key={group}>
                <div className="shell-cmdk-group-heading">{group}</div>
                {items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="shell-cmdk-item"
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
