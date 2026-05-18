'use client';

import { ArrowLeft, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { notFound, useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { BLOCKS, getBlock } from '@/lib/blocks/registry';
import { BLOCK_CATEGORIES } from '@/lib/blocks/types';

type Tab = 'preview' | 'code' | 'placeholders';

/**
 * Single-block detail page: live preview, source code, placeholder bindings,
 * and an "Add to UI generation" affordance.
 *
 * The "Add to UI generation" action stashes the block id on localStorage so
 * the ui-generation page can pick it up — Phase 2 of the Blocks Library plan
 * replaces this with true drag-and-drop into the preview iframe.
 */
export default function BlockDetailPage() {
  const params = useParams<{ blockId: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('preview');

  const block = useMemo(() => getBlock(params.blockId), [params.blockId]);
  if (!block) {
    notFound();
  }
  // notFound() never returns, but TS needs an explicit narrowing here.
  const resolvedBlock = block;

  const categoryLabel =
    BLOCK_CATEGORIES.find((c) => c.id === resolvedBlock.category)?.label ?? resolvedBlock.category;

  function addToUiGeneration() {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem('lighthouse.pendingBlocks');
    let pending: string[] = [];
    try {
      pending = raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      pending = [];
    }
    if (!pending.includes(resolvedBlock.id)) pending.push(resolvedBlock.id);
    window.localStorage.setItem('lighthouse.pendingBlocks', JSON.stringify(pending));
    router.push('/ai-pipeline/ui-generation');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          padding: '12px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <Link
            href="/blocks"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12,
              color: 'var(--muted-foreground)',
              textDecoration: 'none',
            }}
          >
            <ArrowLeft style={{ width: 14, height: 14 }} />
            Blocks
          </Link>
          <span style={{ color: 'var(--muted-foreground)' }}>·</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{resolvedBlock.name}</div>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
              {categoryLabel} · {resolvedBlock.tagline}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link
            href={`/preview/blocks/${resolvedBlock.id}`}
            target="_blank"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 12px',
              border: '1px solid var(--border)',
              borderRadius: 6,
              fontSize: 12,
              color: 'var(--foreground)',
              textDecoration: 'none',
            }}
          >
            Open full preview <ExternalLink style={{ width: 12, height: 12 }} />
          </Link>
          <button
            type="button"
            onClick={addToUiGeneration}
            style={{
              padding: '6px 12px',
              border: 'none',
              borderRadius: 6,
              background: 'var(--primary)',
              color: 'var(--primary-foreground)',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Add to UI generation
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 0,
          padding: '0 20px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {(['preview', 'code', 'placeholders'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
            }}
            style={{
              padding: '8px 14px',
              fontSize: 12,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: tab === t ? 'var(--primary)' : 'var(--muted-foreground)',
              borderBottom: tab === t ? '2px solid var(--primary)' : '2px solid transparent',
              fontWeight: tab === t ? 500 : 400,
              fontFamily: 'inherit',
            }}
          >
            {t === 'preview' && 'Preview'}
            {t === 'code' && 'Code'}
            {t === 'placeholders' &&
              `Placeholders${resolvedBlock.placeholders ? ` (${String(Object.keys(resolvedBlock.placeholders).length)})` : ''}`}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', background: 'var(--muted)' }}>
        {tab === 'preview' && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
            <iframe
              src={`/preview/blocks/${encodeURIComponent(resolvedBlock.id)}`}
              title={`${resolvedBlock.name} preview`}
              sandbox="allow-scripts allow-same-origin"
              style={{
                width: '100%',
                maxWidth: 1200,
                height: '70vh',
                border: '1px solid var(--border)',
                borderRadius: 8,
                background: 'var(--background)',
              }}
            />
          </div>
        )}
        {tab === 'code' && (
          <div
            style={{
              padding: 24,
              maxWidth: 1100,
              margin: '0 auto',
              fontFamily: 'ui-monospace, SFMono-Regular, monospace',
              fontSize: 12,
            }}
          >
            <pre
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: 16,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                color: 'var(--foreground)',
              }}
            >
              {`// ${resolvedBlock.name} — source code view
//
// The JSX renderer for this block lives in:
//   apps/web/src/lib/blocks/registry.tsx
//
// id:        ${resolvedBlock.id}
// category:  ${resolvedBlock.category}
// data-edit-id roots: see block source
//
// Full source rendering of the live JSX tree is a Phase 2 follow-up;
// the registry currently stores blocks as render functions, not source
// strings. Adding source-string generation needs a JSX-to-string serializer
// run at build time so the gallery can show editable code without bundling
// react-jsx-runtime into the preview.
//
// Workaround for now: open the registry file directly to read or edit a block.`}
            </pre>
          </div>
        )}
        {tab === 'placeholders' && (
          <div style={{ padding: 24, maxWidth: 700, margin: '0 auto' }}>
            <div
              style={{
                fontSize: 12,
                color: 'var(--muted-foreground)',
                marginBottom: 12,
              }}
            >
              When this block is dropped into UI generation, these placeholders can be bound to real
              schema fields (Phase 3).
            </div>
            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: 8,
                background: 'var(--card)',
                overflow: 'hidden',
              }}
            >
              {resolvedBlock.placeholders && Object.keys(resolvedBlock.placeholders).length > 0 ? (
                Object.entries(resolvedBlock.placeholders).map(([k, v], i, all) => (
                  <div
                    key={k}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '180px 1fr',
                      padding: '10px 14px',
                      gap: 12,
                      borderBottom: i < all.length - 1 ? '1px solid var(--border)' : 'none',
                      alignItems: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontSize: 11,
                        color: 'var(--foreground)',
                      }}
                    >
                      {k}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{v}</span>
                  </div>
                ))
              ) : (
                <div
                  style={{
                    padding: 14,
                    fontSize: 12,
                    color: 'var(--muted-foreground)',
                  }}
                >
                  No declared placeholders for this block yet.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          padding: '10px 20px',
          borderTop: '1px solid var(--border)',
          fontSize: 11,
          color: 'var(--muted-foreground)',
          display: 'flex',
          gap: 16,
        }}
      >
        <span>
          Showing {BLOCKS.indexOf(block) + 1} of {BLOCKS.length}
        </span>
        <Link href="/blocks" style={{ marginLeft: 'auto', color: 'var(--muted-foreground)' }}>
          ← Back to gallery
        </Link>
      </div>
    </div>
  );
}
