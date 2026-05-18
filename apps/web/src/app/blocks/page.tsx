'use client';

import { Search } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { BLOCKS } from '@/lib/blocks/registry';
import { BLOCK_CATEGORIES, type BlockCategory } from '@/lib/blocks/types';

/**
 * Global Blocks Library gallery.
 *
 * Top-level (not workspace-scoped) catalog of pre-built UI patterns the user
 * can preview, copy, and (Phase 2) drag into the UI generation iframe.
 *
 * Each card is a live iframe pointing at `/preview/blocks/<id>` so the preview
 * matches exactly what will be rendered when the block is dropped.
 */
export default function BlocksGalleryPage() {
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

  const countsByCategory = useMemo(() => {
    const m: Record<string, number> = { all: BLOCKS.length };
    for (const b of BLOCKS) m[b.category] = (m[b.category] ?? 0) + 1;
    return m;
  }, []);

  return (
    <div className="mx-auto max-w-[1440px] p-6" style={{ maxWidth: 1400 }}>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Blocks</h1>
          <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginTop: 4 }}>
            {BLOCKS.length} pre-built UI patterns. Preview, copy, or drag into UI generation.
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flex: 1,
            minWidth: 240,
            maxWidth: 320,
            padding: '6px 10px',
            border: '1px solid var(--border)',
            borderRadius: 6,
            background: 'var(--background)',
          }}
        >
          <Search style={{ width: 14, height: 14, opacity: 0.6 }} />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
            }}
            placeholder="Search blocks…"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: 13,
              color: 'var(--foreground)',
              fontFamily: 'inherit',
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 24 }}>
        <CategoryPill
          active={category === 'all'}
          onClick={() => {
            setCategory('all');
          }}
          label="All"
          count={countsByCategory['all'] ?? 0}
        />
        {BLOCK_CATEGORIES.map((c) => {
          const count = countsByCategory[c.id] ?? 0;
          if (count === 0) return null;
          return (
            <CategoryPill
              key={c.id}
              active={category === c.id}
              onClick={() => {
                setCategory(c.id);
              }}
              label={c.label}
              count={count}
            />
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div
          style={{
            padding: 40,
            textAlign: 'center',
            fontSize: 13,
            color: 'var(--muted-foreground)',
            border: '1px dashed var(--border)',
            borderRadius: 8,
          }}
        >
          No blocks match.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
            gap: 18,
          }}
        >
          {visible.map((block) => (
            <Link
              key={block.id}
              href={`/blocks/${block.id}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                border: '1px solid var(--border)',
                borderRadius: 8,
                background: 'var(--card)',
                overflow: 'hidden',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'border-color 120ms, transform 120ms',
              }}
            >
              <div
                style={{
                  height: 240,
                  background: 'var(--muted)',
                  borderBottom: '1px solid var(--border)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <iframe
                  src={`/preview/blocks/${encodeURIComponent(block.id)}`}
                  title={`${block.name} preview`}
                  sandbox="allow-scripts allow-same-origin"
                  style={{
                    border: 'none',
                    width: '1280px',
                    height: '800px',
                    transform: 'scale(0.30)',
                    transformOrigin: 'top left',
                    pointerEvents: 'none',
                    background: 'var(--background)',
                  }}
                />
              </div>
              <div style={{ padding: '10px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{block.name}</span>
                  {block.isNew && (
                    <span
                      style={{
                        fontSize: 9,
                        padding: '1px 6px',
                        borderRadius: 999,
                        background: 'oklch(0.55 0.22 250)',
                        color: 'white',
                        fontWeight: 600,
                      }}
                    >
                      NEW
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                  {block.tagline}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryPill({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 12px',
        borderRadius: 999,
        border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
        background: active ? 'var(--accent)' : 'transparent',
        color: active ? 'var(--primary)' : 'var(--foreground)',
        fontSize: 12,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {label}
      <span
        style={{
          fontSize: 10,
          opacity: 0.6,
        }}
      >
        {count}
      </span>
    </button>
  );
}
