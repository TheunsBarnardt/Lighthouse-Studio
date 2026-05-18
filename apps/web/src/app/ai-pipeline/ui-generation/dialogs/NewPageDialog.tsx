'use client';

import { FileText, LayoutGrid, ListChecks, LogIn, MailQuestion, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { MockArtifactId } from '@/app/preview/mock-components';

export type PageKind = MockArtifactId;

interface NewPageDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (input: { name: string; kind: PageKind }) => void;
  existingNames: string[];
}

/**
 * "+ New page" dialog launched from the components rail.
 *
 * Lets the user pick a starting page archetype (list / detail / dashboard /
 * auth / shell) and a name. The page entry is appended to the local
 * components list and selected. Real artifact generation (Objective 26 §6)
 * will replace this with a `composeUi` call that scaffolds a new artifact
 * server-side.
 */
const PAGE_KINDS: { id: PageKind; label: string; description: string; icon: React.ReactNode }[] = [
  {
    id: 'ContactsListPage',
    label: 'List page',
    description: 'Table or grid of records',
    icon: <ListChecks style={{ width: 16, height: 16 }} />,
  },
  {
    id: 'ContactDetailPage',
    label: 'Detail page',
    description: 'One record, fields + actions',
    icon: <FileText style={{ width: 16, height: 16 }} />,
  },
  {
    id: 'Dashboard',
    label: 'Dashboard',
    description: 'Stats + recent activity',
    icon: <LayoutGrid style={{ width: 16, height: 16 }} />,
  },
  {
    id: 'SignInPage',
    label: 'Auth page',
    description: 'Sign-in / sign-up form',
    icon: <LogIn style={{ width: 16, height: 16 }} />,
  },
  {
    id: 'AppShell',
    label: 'App shell',
    description: 'Sidebar + main content layout',
    icon: <MailQuestion style={{ width: 16, height: 16 }} />,
  },
];

export function NewPageDialog({ open, onClose, onCreate, existingNames }: NewPageDialogProps) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<PageKind>('ContactsListPage');

  useEffect(() => {
    if (open) {
      setName('');
      setKind('ContactsListPage');
    }
  }, [open]);

  if (!open) return null;

  const trimmed = name.trim();
  const collision = existingNames.includes(trimmed);
  const canSubmit = trimmed.length > 0 && !collision;

  function submit() {
    if (!canSubmit) return;
    onCreate({ name: trimmed, kind });
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => {
          e.stopPropagation();
        }}
        style={{
          width: '100%',
          maxWidth: 480,
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 14 }}>New page</div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--muted-foreground)',
              cursor: 'pointer',
            }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label
            style={{
              fontSize: 12,
              fontWeight: 500,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            Page name
            <input
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
              placeholder="e.g. ProjectsListPage"
              style={{
                padding: '8px 10px',
                border: '1px solid var(--border)',
                borderRadius: 4,
                fontSize: 13,
                fontFamily: 'monospace',
                background: 'var(--background)',
                color: 'var(--foreground)',
              }}
            />
            {collision && (
              <span style={{ fontSize: 11, color: 'var(--destructive)' }}>
                A page named “{trimmed}” already exists.
              </span>
            )}
          </label>

          <div>
            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 6 }}>Starting archetype</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {PAGE_KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => {
                    setKind(k.id);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: 10,
                    border: `1px solid ${kind === k.id ? 'var(--primary)' : 'var(--border)'}`,
                    background: kind === k.id ? 'var(--accent)' : 'var(--background)',
                    color: kind === k.id ? 'var(--primary)' : 'var(--foreground)',
                    borderRadius: 6,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                  }}
                >
                  <span style={{ flexShrink: 0, marginTop: 1 }}>{k.icon}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 12, fontWeight: 500 }}>
                      {k.label}
                    </span>
                    <span
                      style={{ display: 'block', fontSize: 10, color: 'var(--muted-foreground)' }}
                    >
                      {k.description}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div
          style={{
            padding: '10px 16px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 12px',
              borderRadius: 4,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--foreground)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            style={{
              padding: '6px 12px',
              borderRadius: 4,
              border: 'none',
              background: canSubmit ? 'var(--primary)' : 'var(--muted)',
              color: canSubmit ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
              fontSize: 12,
              fontWeight: 500,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
            }}
          >
            Create page
          </button>
        </div>
      </div>
    </div>
  );
}
