'use client';

import { useState } from 'react';

import type { ModeSemantics, Primitives, TokenRef } from '@/lib/theme/types';
import { SEMANTIC_KEYS } from '@/lib/theme/types';
import { resolveToken } from '@/lib/theme/alias-graph';
import { contrastRatio, parseHslTuple, wcagLevel } from '@/lib/theme/color';

import { useThemeEditor } from '@/state/theme-editor-store';

import { AliasPicker } from './alias-picker';

const PAIRS: Record<string, string> = {
  background: 'foreground',
  foreground: 'background',
  card: 'card-foreground',
  'card-foreground': 'card',
  primary: 'primary-foreground',
  'primary-foreground': 'primary',
  secondary: 'secondary-foreground',
  'secondary-foreground': 'secondary',
  muted: 'muted-foreground',
  'muted-foreground': 'muted',
  accent: 'accent-foreground',
  'accent-foreground': 'accent',
  destructive: 'destructive-foreground',
  'destructive-foreground': 'destructive',
};

interface SemanticsPanelProps {
  primitives: Primitives;
  light: ModeSemantics;
  dark: ModeSemantics;
  onHoverKeys?: (keys: string[]) => void;
  highlightKeys?: string[];
  pinnedKeys?: string[];
  onTogglePinned?: (key: string) => void;
}

export function SemanticsPanel({
  primitives,
  light,
  dark,
  onHoverKeys,
  highlightKeys,
  pinnedKeys,
  onTogglePinned,
}: SemanticsPanelProps): JSX.Element {
  return (
    <div>
      <div className="grid grid-cols-[minmax(140px,180px)_1fr_1fr] gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b pb-2 mb-1">
        <span>Token</span>
        <span>Light</span>
        <span>Dark</span>
      </div>
      <div className="divide-y divide-border">
        {SEMANTIC_KEYS.map((key) => (
          <SemanticRow
            key={key}
            tokenKey={key}
            primitives={primitives}
            light={light[key] ?? { value: '0 0% 50%' }}
            dark={dark[key] ?? { value: '0 0% 50%' }}
            highlighted={highlightKeys?.includes(key) === true}
            pinned={pinnedKeys?.includes(key) === true}
            onHover={onHoverKeys}
            onTogglePin={onTogglePinned}
          />
        ))}
      </div>
    </div>
  );
}

function SemanticRow({
  tokenKey,
  primitives,
  light,
  dark,
  highlighted,
  pinned,
  onHover,
  onTogglePin,
}: {
  tokenKey: string;
  primitives: Primitives;
  light: TokenRef;
  dark: TokenRef;
  highlighted: boolean;
  pinned: boolean;
  onHover?: (keys: string[]) => void;
  onTogglePin?: (key: string) => void;
}): JSX.Element {
  const { setSemanticRef } = useThemeEditor();
  return (
    <div
      className={`grid grid-cols-[minmax(140px,180px)_1fr_1fr] gap-2 items-center py-1.5 rounded ${
        pinned
          ? 'bg-primary/10 ring-1 ring-primary/60'
          : highlighted
            ? 'bg-primary/5 ring-1 ring-primary/30'
            : ''
      }`}
      onMouseEnter={() => onHover?.([tokenKey])}
      onMouseLeave={() => onHover?.([])}
    >
      <button
        type="button"
        onClick={() => onTogglePin?.(tokenKey)}
        className="text-xs font-mono pl-1 truncate text-left hover:text-primary"
        title={`${tokenKey} — click to pin in preview`}
      >
        {pinned ? '📌 ' : ''}
        {tokenKey}
      </button>
      <div className="flex items-center gap-1">
        <ModeCell
          tokenKey={tokenKey}
          tokenRef={light}
          primitives={primitives}
          onChange={(next) => setSemanticRef('light', tokenKey, next)}
          modeName="light"
        />
        <button
          type="button"
          onClick={() => useThemeEditor.getState().mirrorSemantic(tokenKey, 'light-to-dark', true)}
          className="text-muted-foreground hover:text-primary text-xs shrink-0"
          title="Mirror light → dark (inverts literal lightness)"
        >
          ↻
        </button>
      </div>
      <ModeCell
        tokenKey={tokenKey}
        tokenRef={dark}
        primitives={primitives}
        onChange={(next) => setSemanticRef('dark', tokenKey, next)}
        modeName="dark"
      />
    </div>
  );
}

function ModeCell({
  tokenKey,
  tokenRef,
  primitives,
  onChange,
  modeName,
}: {
  tokenKey: string;
  tokenRef: TokenRef;
  primitives: Primitives;
  onChange: (next: TokenRef) => void;
  modeName: 'light' | 'dark';
}): JSX.Element {
  const [open, setOpen] = useState(false);
  let resolved = '0 0% 50%';
  let resolveOk = true;
  try {
    resolved = resolveToken(tokenRef, primitives);
  } catch {
    resolveOk = false;
  }

  const pair = PAIRS[tokenKey];
  const isAlias = 'ref' in tokenRef;
  const refLabel = isAlias ? tokenRef.ref.replace('primitives.colors.', '').replace('primitives.', '') : 'literal';

  let contrastLabel: string | null = null;
  let contrastClass = 'text-muted-foreground';

  const { current } = useThemeEditor.getState();
  if (pair && current) {
    try {
      const pairRef = current.semantics[modeName][pair];
      if (pairRef) {
        const a = parseHslTuple(resolved);
        const b = parseHslTuple(resolveToken(pairRef, primitives));
        const ratio = contrastRatio(a, b);
        const level = wcagLevel(ratio);
        contrastLabel = `${ratio.toFixed(1)} ${level === 'fail' ? 'fail' : level}`;
        if (level === 'AAA') contrastClass = 'text-success';
        else if (level === 'AA') contrastClass = 'text-foreground';
        else if (level === 'AA-large') contrastClass = 'text-warning';
        else contrastClass = 'text-destructive';
      }
    } catch {
      /* malformed */
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 w-full rounded border px-2 py-1 text-left hover:bg-muted/50 ${
          resolveOk ? 'border-border' : 'border-destructive'
        }`}
      >
        <span
          className="h-4 w-4 rounded-sm border border-border shrink-0"
          style={{ background: `hsl(${resolved})` }}
        />
        <span className={`text-[11px] font-mono truncate ${isAlias ? '' : 'italic text-muted-foreground'}`}>
          {refLabel}
        </span>
        {contrastLabel ? (
          <span className={`ml-auto text-[10px] font-mono ${contrastClass}`}>{contrastLabel}</span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute z-30 right-0 top-full mt-1">
          <AliasPicker value={tokenRef} primitives={primitives} onChange={onChange} onClose={() => setOpen(false)} />
        </div>
      ) : null}
    </div>
  );
}
