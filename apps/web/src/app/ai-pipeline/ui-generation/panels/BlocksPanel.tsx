'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { BLOCKS } from '@/lib/blocks/registry';
import { BLOCK_CATEGORIES, type BlockCategory } from '@/lib/blocks/types';

interface BlocksPanelProps {
  /** Push a block into the preview iframe by id. */
  onInsert: (blockId: string) => void;
}

/**
 * In-page blocks browser inside the UI generation surface.
 *
 * v1 ships click-to-insert (the "+" button on each row sends `insert-block`
 * through the preview postMessage protocol). HTML5 cross-iframe drag is the
 * v1.1 follow-up — same insert action, just triggered by drop.
 */
export function BlocksPanel({ onInsert }: BlocksPanelProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<BlockCategory | 'all'>('all');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return BLOCKS.filter((b) => {
      if (category !== 'all' && b.category !== category) return false;
      if (!q) return true;
      return b.name.toLowerCase().includes(q) || b.tagline.toLowerCase().includes(q);
    });
  }, [query, category]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--muted-foreground)',
          }}
        >
          Blocks
        </div>
        <Link
          href="/blocks"
          style={{ fontSize: 10, color: 'var(--muted-foreground)', textDecoration: 'none' }}
        >
          Browse all →
        </Link>
      </div>
      <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
          placeholder="Search blocks…"
          style={{
            padding: '4px 8px',
            border: '1px solid var(--border)',
            borderRadius: 4,
            fontSize: 11,
            background: 'var(--background)',
            color: 'var(--foreground)',
            fontFamily: 'inherit',
          }}
        />
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value as BlockCategory | 'all');
          }}
          style={{
            padding: '4px 6px',
            border: '1px solid var(--border)',
            borderRadius: 4,
            fontSize: 11,
            background: 'var(--background)',
            color: 'var(--foreground)',
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          <option value="all">All categories</option>
          {BLOCK_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 4px 8px' }}>
        {visible.length === 0 && (
          <div
            style={{
              padding: 12,
              fontSize: 11,
              color: 'var(--muted-foreground)',
              textAlign: 'center',
            }}
          >
            No matches.
          </div>
        )}
        {visible.map((block) => (
          <div
            key={block.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/x-lighthouse-block-id', block.id);
              e.dataTransfer.effectAllowed = 'copy';
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 6,
              padding: '6px 8px',
              borderRadius: 4,
              cursor: 'grab',
              fontSize: 11,
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'var(--muted)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
            title={block.tagline}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 500,
                  color: 'var(--foreground)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {block.name}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: 'var(--muted-foreground)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {block.tagline}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                onInsert(block.id);
              }}
              title="Insert into preview"
              style={{
                padding: 4,
                border: '1px solid var(--border)',
                borderRadius: 3,
                background: 'var(--background)',
                color: 'var(--primary)',
                cursor: 'pointer',
              }}
            >
              <Plus style={{ width: 12, height: 12 }} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
