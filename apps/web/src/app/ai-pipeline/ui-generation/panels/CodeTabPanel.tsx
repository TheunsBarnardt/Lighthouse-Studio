'use client';

import { Copy } from 'lucide-react';
import { useState } from 'react';

import { getBlock } from '@/lib/blocks/registry';
import { getBlockSource } from '@/lib/blocks/sources';

interface CodeTabPanelProps {
  artifactId: string;
  insertedBlockIds: string[];
}

/**
 * Live code view for the current composition.
 *
 * Shows the base mock component's identity at the top, then a numbered
 * sequence of source-string snippets for every block that's been inserted
 * (from BLOCK_SOURCES). One Copy button per snippet copies just that block's
 * source; one Copy-all at the top copies the full composition.
 *
 * The base component itself doesn't have a serializable source string yet
 * (mock-components.tsx renders JSX directly). When real artifact generation
 * lands the base will produce a real source artifact too — this panel will
 * concatenate it with the block sources without changes.
 */
export function CodeTabPanel({ artifactId, insertedBlockIds }: CodeTabPanelProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  function copy(key: string, text: string) {
    if (typeof navigator === 'undefined') return;
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey(null);
      }, 1200);
      return undefined;
    });
  }

  const insertedSources: { id: string; name: string; source: string }[] = [];
  for (const id of insertedBlockIds) {
    const block = getBlock(id);
    const source = getBlockSource(id);
    if (block && source) insertedSources.push({ id, name: block.name, source });
  }

  const baseHeader = `// Page: ${artifactId}
// Composition: 1 base component${
    insertedSources.length > 0
      ? ` + ${String(insertedSources.length)} inserted block${insertedSources.length === 1 ? '' : 's'}`
      : ''
  }
//
// Base component lives at apps/web/src/app/preview/mock-components.tsx.
// When real artifact generation lands (Objective 26 §6), this file is replaced
// by the actual emitted .tsx for the page.\n`;

  const allSource = [
    baseHeader,
    ...insertedSources.map((s) => `// ─── ${s.name} ───\n${s.source}\n`),
  ].join('\n');

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: 'var(--card)' }}>
      <div
        style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          background: 'var(--muted)',
          position: 'sticky',
          top: 0,
          zIndex: 1,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)' }}>
          {insertedSources.length === 0
            ? 'Base page · no inserted blocks yet'
            : `${String(insertedSources.length)} inserted block${insertedSources.length === 1 ? '' : 's'}`}
        </span>
        <button
          type="button"
          onClick={() => {
            copy('all', allSource);
          }}
          disabled={insertedSources.length === 0}
          style={{
            padding: '4px 8px',
            fontSize: 11,
            border: '1px solid var(--border)',
            borderRadius: 4,
            background: copiedKey === 'all' ? 'var(--accent)' : 'transparent',
            color: copiedKey === 'all' ? 'var(--primary)' : 'var(--foreground)',
            cursor: insertedSources.length === 0 ? 'not-allowed' : 'pointer',
            opacity: insertedSources.length === 0 ? 0.5 : 1,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontFamily: 'inherit',
          }}
        >
          <Copy style={{ width: 11, height: 11 }} />
          {copiedKey === 'all' ? 'Copied' : 'Copy all'}
        </button>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Snippet
          name={`Base · ${artifactId}`}
          source={`// ${artifactId} (base mock component)
// Source: apps/web/src/app/preview/mock-components.tsx
// Edit this file directly to change the base page.`}
          copyKey="base"
          copiedKey={copiedKey}
          onCopy={copy}
        />
        {insertedSources.map((s, i) => (
          <Snippet
            key={`${s.id}-${String(i)}`}
            name={`${String(i + 1)}. ${s.name}`}
            source={s.source}
            copyKey={`block-${String(i)}`}
            copiedKey={copiedKey}
            onCopy={copy}
          />
        ))}
        {insertedSources.length === 0 && (
          <p
            style={{
              fontSize: 12,
              color: 'var(--muted-foreground)',
              textAlign: 'center',
              padding: 16,
            }}
          >
            Insert a block from the BlocksPanel to see its source here.
          </p>
        )}
      </div>
    </div>
  );
}

function Snippet({
  name,
  source,
  copyKey,
  copiedKey,
  onCopy,
}: {
  name: string;
  source: string;
  copyKey: string;
  copiedKey: string | null;
  onCopy: (key: string, text: string) => void;
}) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
      <div
        style={{
          padding: '6px 12px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            fontSize: 11,
            color: 'var(--foreground)',
          }}
        >
          {name}
        </span>
        <button
          type="button"
          onClick={() => {
            onCopy(copyKey, source);
          }}
          title="Copy"
          style={{
            background: 'transparent',
            border: 'none',
            color: copiedKey === copyKey ? 'var(--primary)' : 'var(--muted-foreground)',
            cursor: 'pointer',
            fontSize: 11,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Copy style={{ width: 11, height: 11 }} />
          {copiedKey === copyKey ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre
        style={{
          margin: 0,
          padding: 12,
          fontSize: 11,
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          background: 'var(--background)',
          color: 'var(--foreground)',
          overflowX: 'auto',
          lineHeight: 1.5,
        }}
      >
        {source}
      </pre>
    </div>
  );
}
