'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import type { Primitives, TokenRef } from '@/lib/theme/types';
import { listPrimitiveRefs, resolveRef } from '@/lib/theme/alias-graph';

import { Input } from '@/components/ui/input';

interface AliasPickerProps {
  value: TokenRef;
  primitives: Primitives;
  onChange: (next: TokenRef) => void;
  onClose: () => void;
}

export function AliasPicker({ value, primitives, onChange, onClose }: AliasPickerProps): JSX.Element {
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const refs = useMemo(() => listPrimitiveRefs(primitives), [primitives]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return refs.slice(0, 25);
    return refs.filter((r) => r.toLowerCase().includes(q)).slice(0, 25);
  }, [refs, query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function commitRef(ref: string): void {
    onChange({ ref });
    onClose();
  }

  function commitLiteral(): void {
    if ('value' in value) {
      onClose();
      return;
    }
    const resolved = resolveRef(value.ref, primitives) ?? '0 0% 50%';
    onChange({ value: resolved });
    onClose();
  }

  return (
    <div className="rounded-md border bg-card shadow-md p-2 w-72">
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
            const ref = filtered[activeIdx];
            if (ref) commitRef(ref);
            e.preventDefault();
          } else if (e.key === 'Escape') {
            onClose();
          }
        }}
        placeholder="Search primitives…"
        className="mb-2"
      />
      <div className="max-h-64 overflow-y-auto text-xs">
        {filtered.length === 0 ? (
          <div className="px-2 py-3 text-muted-foreground text-center">No matches</div>
        ) : (
          filtered.map((ref, i) => {
            const resolved = resolveRef(ref, primitives);
            const isColor = ref.startsWith('primitives.colors.');
            return (
              <button
                key={ref}
                type="button"
                onClick={() => commitRef(ref)}
                onMouseEnter={() => setActiveIdx(i)}
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left ${
                  i === activeIdx ? 'bg-muted' : ''
                }`}
              >
                {isColor && resolved ? (
                  <span
                    className="h-3 w-3 rounded-sm border border-border shrink-0"
                    style={{ background: `hsl(${resolved})` }}
                  />
                ) : (
                  <span className="h-3 w-3 shrink-0" />
                )}
                <span className="font-mono truncate">{ref.replace('primitives.', '')}</span>
                {resolved ? (
                  <span className="ml-auto text-[10px] text-muted-foreground font-mono truncate">
                    {resolved}
                  </span>
                ) : null}
              </button>
            );
          })
        )}
      </div>
      <div className="mt-2 flex items-center justify-between border-t pt-2">
        <button
          type="button"
          onClick={commitLiteral}
          className="text-[11px] text-muted-foreground hover:text-foreground"
        >
          Detach to literal value
        </button>
        <span className="text-[10px] text-muted-foreground">↑↓ navigate · ↵ select · esc</span>
      </div>
    </div>
  );
}
