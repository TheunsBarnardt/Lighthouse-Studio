'use client';

import { useState } from 'react';

import type { ColorScale, Primitives } from '@/lib/theme/types';
import { SCALE_STEPS } from '@/lib/theme/types';
import { hexToHsl, hslToHex, parseHslTuple, formatHslTuple } from '@/lib/theme/color';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

import { useThemeEditor } from '@/state/theme-editor-store';

export function PrimitivesPanel({ primitives }: { primitives: Primitives }): JSX.Element {
  const groups = Object.keys(primitives.colors);
  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-semibold mb-3">Color primitives</h3>
        <div className="space-y-4">
          {groups.map((group) => (
            <ColorGroup key={group} group={group} scale={primitives.colors[group]!} />
          ))}
        </div>
      </section>
      <section>
        <h3 className="text-sm font-semibold mb-3">Spacing</h3>
        <ScalarBag bag={primitives.spacing} kind="spacing" />
      </section>
      <section>
        <h3 className="text-sm font-semibold mb-3">Border radius</h3>
        <ScalarBag bag={primitives.radius} kind="radius" />
      </section>
    </div>
  );
}

function ColorGroup({ group, scale }: { group: string; scale: ColorScale }): JSX.Element {
  const { setPrimitiveColorBase, setPrimitiveColorStep, regenerateScale, setSelected } = useThemeEditor();

  const [baseHex, setBaseHex] = useState(() => {
    try {
      return hslToHex(parseHslTuple(scale.base));
    } catch {
      return '#000000';
    }
  });

  function applyBase(hex: string): void {
    setBaseHex(hex);
    try {
      const tuple = formatHslTuple(hexToHsl(hex));
      setPrimitiveColorBase(group, tuple);
    } catch {
      /* invalid */
    }
  }

  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold capitalize">{group}</span>
          <input
            type="color"
            value={baseHex}
            onChange={(e) => applyBase(e.target.value)}
            className="h-6 w-8 rounded border border-border cursor-pointer bg-background"
            aria-label={`${group} base color`}
          />
          <Input
            value={baseHex}
            onChange={(e) => applyBase(e.target.value)}
            className="h-7 w-24 font-mono text-xs"
          />
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => regenerateScale(group, true)}
          title="Regenerate scale (preserves manual overrides)"
        >
          ↻ Regenerate
        </Button>
      </div>
      <div className="grid grid-cols-10 gap-1">
        {SCALE_STEPS.map((step) => (
          <ScaleSwatch key={step} group={group} step={step} scale={scale} onSelect={() => setSelected(`primitives.colors.${group}.${step}`)} />
        ))}
      </div>
    </div>
  );
}

function ScaleSwatch({
  group,
  step,
  scale,
  onSelect,
}: {
  group: string;
  step: string;
  scale: ColorScale;
  onSelect: () => void;
}): JSX.Element {
  const tuple = scale.steps[step] ?? '0 0% 50%';
  const manual = scale.manual?.[step] === true;
  const { setPrimitiveColorStep } = useThemeEditor();
  const [editing, setEditing] = useState(false);
  const hex = (() => {
    try {
      return hslToHex(parseHslTuple(tuple));
    } catch {
      return '#888888';
    }
  })();

  return (
    <div className="relative">
      <button
        type="button"
        className="w-full aspect-square rounded border border-border relative overflow-hidden"
        style={{ background: `hsl(${tuple})` }}
        onClick={() => {
          setEditing(true);
          onSelect();
        }}
        title={`${step} • ${tuple}`}
      >
        {manual ? (
          <span className="absolute top-0 right-0 h-1.5 w-1.5 rounded-full bg-warning border border-background" aria-label="manual override" />
        ) : null}
      </button>
      <div className="text-center text-[9px] text-muted-foreground mt-0.5 font-mono">{step}</div>
      {editing ? (
        <div className="absolute z-20 left-1/2 top-full -translate-x-1/2 mt-1 rounded-md border bg-card p-2 shadow-md w-40">
          <input
            type="color"
            defaultValue={hex}
            onChange={(e) => {
              try {
                setPrimitiveColorStep(group, step, formatHslTuple(hexToHsl(e.target.value)), true);
              } catch {
                /* invalid */
              }
            }}
            className="w-full h-8 rounded cursor-pointer"
          />
          <div className="flex gap-1 mt-2">
            <Button size="sm" variant="outline" className="flex-1" onClick={() => setEditing(false)}>
              Done
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setPrimitiveColorStep(group, step, tuple, false);
                setEditing(false);
              }}
              title="Mark as auto-generated"
            >
              Auto
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ScalarBag({ bag, kind }: { bag: Record<string, string>; kind: 'spacing' | 'radius' }): JSX.Element {
  const { setSpacing, setRadius } = useThemeEditor();
  const setter = kind === 'spacing' ? setSpacing : setRadius;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {Object.entries(bag).map(([k, v]) => (
        <div key={k} className="flex items-center gap-2">
          <span className="text-xs font-mono w-10 text-muted-foreground">{k}</span>
          <Input
            value={v}
            onChange={(e) => setter(k, e.target.value)}
            className="h-7 font-mono text-xs"
          />
        </div>
      ))}
    </div>
  );
}
