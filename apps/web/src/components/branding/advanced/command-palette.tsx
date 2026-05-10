'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import type { WorkspaceTheme } from '@/lib/theme/types';
import { SEMANTIC_KEYS } from '@/lib/theme/types';
import { listPrimitiveRefs, resolveRef } from '@/lib/theme/alias-graph';

import { Input } from '@/components/ui/input';

interface CommandPaletteProps {
  open: boolean;
  theme: WorkspaceTheme;
  onClose: () => void;
  onSelect: (path: string) => void;
}

export function CommandPalette({ open, theme, onClose, onSelect }: CommandPaletteProps): JSX.Element | null {
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo(() => {
    const refs = listPrimitiveRefs(theme.primitives).map((r) => ({ kind: 'primitive' as const, path: r, label: r.replace('primitives.', '') }));
    const semanticItems = SEMANTIC_KEYS.flatMap((k) => [
      { kind: 'semantic' as const, path: `semantics.light.${k}`, label: `light · ${k}` },
      { kind: 'semantic' as const, path: `semantics.dark.${k}`, label: `dark · ${k}` },
    ]);
    return [...semanticItems, ...refs];
  }, [theme]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 30);
    return items.filter((i) => i.label.toLowerCase().includes(q) || i.path.toLowerCase().includes(q)).slice(0, 30);
  }, [items, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-lg border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b p-2">
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIdx(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
                e.preventDefault();
              } else if (e.key === 'ArrowUp') {
                setActiveIdx((i) => Math.max(0, i - 1));
                e.preventDefault();
              } else if (e.key === 'Enter') {
                const item = filtered[activeIdx];
                if (item) {
                  onSelect(item.path);
                  onClose();
                }
                e.preventDefault();
              } else if (e.key === 'Escape') {
                onClose();
              }
            }}
            placeholder="Search tokens by name, value, or path…"
            className="border-0 focus-visible:ring-0 text-sm"
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-1 text-sm">
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-muted-foreground">No matches</div>
          ) : (
            filtered.map((item, i) => {
              const isPrimitive = item.kind === 'primitive';
              const resolved = isPrimitive ? resolveRef(item.path, theme.primitives) : null;
              const isColor = isPrimitive && item.path.startsWith('primitives.colors.');
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => {
                    onSelect(item.path);
                    onClose();
                  }}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={`flex w-full items-center gap-2 rounded px-3 py-1.5 text-left ${
                    i === activeIdx ? 'bg-muted' : ''
                  }`}
                >
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-16 shrink-0">
                    {item.kind}
                  </span>
                  {isColor && resolved ? (
                    <span
                      className="h-3 w-3 rounded-sm border border-border shrink-0"
                      style={{ background: `hsl(${resolved})` }}
                    />
                  ) : null}
                  <span className="font-mono text-xs truncate">{item.label}</span>
                  {resolved ? (
                    <span className="ml-auto text-[10px] text-muted-foreground font-mono truncate">{resolved}</span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
        <div className="border-t px-3 py-1.5 text-[10px] text-muted-foreground flex items-center justify-between">
          <span>↑↓ navigate · ↵ select · esc close</span>
          <span className="font-mono">{filtered.length} results</span>
        </div>
      </div>
    </div>
  );
}
