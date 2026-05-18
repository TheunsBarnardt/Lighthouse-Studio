'use client';

import { Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { MockArtifactId } from '@/app/preview/mock-components';

export interface PageEntry {
  id: string;
  label: string;
  kind: MockArtifactId;
}

interface PagesPanelProps {
  pages: PageEntry[];
  selectedId: string;
  onSelect: (entry: PageEntry) => void;
  onNew: () => void;
  approvedSet: Set<string>;
}

/**
 * Pages tab content for the tabbed left rail.
 *
 * Search box + scrollable list + dedicated "New page" button at the top.
 * Used to be three stacked sections sharing one column; now this panel owns
 * the full rail height when its tab is active.
 */
export function PagesPanel({ pages, selectedId, onSelect, onNew, approvedSet }: PagesPanelProps) {
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pages;
    return pages.filter((p) => p.label.toLowerCase().includes(q));
  }, [pages, query]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '1px solid var(--border)',
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--muted-foreground)',
          }}
        >
          {pages.length} page{pages.length === 1 ? '' : 's'}
        </span>
        <button
          type="button"
          onClick={onNew}
          title="New page"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 2,
            padding: '3px 8px',
            border: '1px solid var(--border)',
            borderRadius: 4,
            background: 'transparent',
            color: 'var(--primary)',
            fontSize: 10,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <Plus style={{ width: 11, height: 11 }} />
          New
        </button>
      </div>

      <div style={{ padding: 8 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 8px',
            border: '1px solid var(--border)',
            borderRadius: 4,
            background: 'var(--background)',
          }}
        >
          <Search style={{ width: 12, height: 12, opacity: 0.6 }} />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
            }}
            placeholder="Filter pages…"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: 11,
              color: 'var(--foreground)',
              fontFamily: 'inherit',
            }}
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
        {visible.length === 0 && (
          <p
            style={{
              fontSize: 11,
              color: 'var(--muted-foreground)',
              textAlign: 'center',
              padding: 12,
            }}
          >
            {query ? 'No pages match.' : 'No pages yet.'}
          </p>
        )}
        {visible.map((item) => {
          const isApproved = approvedSet.has(item.id);
          const isActive = item.id === selectedId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelect(item);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                width: '100%',
                textAlign: 'left',
                padding: '5px 8px',
                borderRadius: 4,
                marginBottom: 1,
                background: isActive ? 'var(--accent)' : 'transparent',
                color: isActive ? 'var(--primary)' : 'var(--muted-foreground)',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'monospace',
                fontSize: 11,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: isApproved ? 'oklch(0.40 0.14 145)' : 'var(--border)',
                  flexShrink: 0,
                }}
              />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
