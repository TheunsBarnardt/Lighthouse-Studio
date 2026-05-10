'use client';

import { type ReactNode } from 'react';

import type { WorkspaceTheme } from '@/lib/theme/types';
import { resolveMode } from '@/lib/theme/serialize';
import { simulateCvd, parseHslTuple, formatHslTuple } from '@/lib/theme/color';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface PreviewSurfaceProps {
  theme: WorkspaceTheme;
  mode: 'light' | 'dark';
  cvd?: 'normal' | 'protanopia' | 'deuteranopia' | 'tritanopia';
  highlightSemantics?: string[];
  pinnedSemantics?: string[];
  onHoverSemantics?: (keys: string[]) => void;
  onPinSemantics?: (keys: string[]) => void;
  compact?: boolean;
}

const COMPONENT_USAGE: Record<string, string[]> = {
  button: ['primary', 'primary-foreground', 'ring', 'border', 'background', 'foreground', 'secondary', 'secondary-foreground', 'destructive', 'destructive-foreground'],
  card: ['card', 'card-foreground', 'border', 'muted-foreground'],
  alert: ['border', 'foreground', 'muted-foreground', 'destructive'],
  form: ['input', 'border', 'foreground', 'muted-foreground', 'ring'],
  badge: ['primary', 'primary-foreground', 'secondary', 'secondary-foreground'],
  toggle: ['primary', 'muted', 'background'],
  table: ['border', 'foreground', 'muted-foreground', 'card'],
  toast: ['card', 'card-foreground', 'border', 'success', 'warning', 'error', 'info'],
};

function inlineStyle(theme: WorkspaceTheme, mode: 'light' | 'dark', cvd: PreviewSurfaceProps['cvd']): React.CSSProperties {
  const resolved = resolveMode(theme, mode);
  const cssVars: Record<string, string> = {};
  // rawHsl keeps the bare tuple so we can map to shell tokens below
  const rawHsl: Record<string, string> = {};

  for (const [k, v] of Object.entries(resolved.vars)) {
    if (k.startsWith('--color-')) {
      let tuple = v;
      if (cvd && cvd !== 'normal') {
        try {
          tuple = formatHslTuple(simulateCvd(parseHslTuple(v), cvd));
        } catch {
          /* fall through */
        }
      }
      rawHsl[k] = tuple;
      // Store as a full CSS color value so Tailwind utility classes (bg-primary, etc.) work
      cssVars[k] = `hsl(${tuple})`;
    } else {
      cssVars[k] = v;
    }
  }

  // Map theme color tokens to shell tokens so Input, Label, etc. reflect preset changes
  const pick = (key: string, fallback: string) => cssVars[key] ?? fallback;
  cssVars['--bg-canvas'] = pick('--color-background', 'hsl(0 0% 98%)');
  cssVars['--bg-surface'] = pick('--color-card', pick('--color-background', 'hsl(0 0% 100%)'));
  cssVars['--bg-input'] = pick('--color-input', pick('--color-background', 'hsl(0 0% 100%)'));
  cssVars['--fg-primary'] = pick('--color-foreground', 'hsl(0 0% 10%)');
  cssVars['--fg-secondary'] = pick('--color-muted-foreground', 'hsl(0 0% 45%)');
  cssVars['--fg-tertiary'] = pick('--color-muted-foreground', 'hsl(0 0% 60%)');
  cssVars['--fg-danger'] = pick('--color-destructive', 'hsl(0 84% 60%)');
  cssVars['--border-default'] = pick('--color-border', 'hsl(0 0% 90%)');
  cssVars['--border-focus'] = pick('--color-ring', 'hsl(220 90% 56%)');
  cssVars['--accent-primary'] = pick('--color-primary', 'hsl(220 90% 56%)');
  cssVars['--accent-primary-fg'] = pick('--color-primary-foreground', 'hsl(0 0% 100%)');

  return cssVars as unknown as React.CSSProperties;
}

function HoverGroup({
  ids,
  highlight,
  pinned,
  onHover,
  onPin,
  children,
}: {
  ids: string[];
  highlight?: string[];
  pinned?: string[];
  onHover?: (keys: string[]) => void;
  onPin?: (keys: string[]) => void;
  children: ReactNode;
}): JSX.Element {
  const isHovered = highlight?.some((h) => ids.includes(h));
  const isPinned = pinned?.some((p) => ids.includes(p));
  const ringStyle: React.CSSProperties | undefined = isPinned
    ? {
        boxShadow: `0 0 0 2px var(--color-primary), 0 0 0 6px color-mix(in srgb, var(--color-primary) 25%, transparent)`,
        borderRadius: 'var(--radius-md, 0.5rem)',
        animation: 'workspace-theme-pulse 1.6s ease-in-out infinite',
      }
    : isHovered
      ? { boxShadow: `0 0 0 2px color-mix(in srgb, var(--color-ring) 60%, transparent)`, borderRadius: 'var(--radius-md, 0.5rem)' }
      : undefined;

  return (
    <div
      onMouseEnter={() => onHover?.(ids)}
      onMouseLeave={() => onHover?.([])}
      onClick={(e) => {
        if (!onPin) return;
        e.stopPropagation();
        onPin(ids);
      }}
      className={`rounded-md transition-shadow ${onPin ? 'cursor-pointer' : ''}`}
      style={ringStyle}
    >
      {children}
    </div>
  );
}

export function PreviewSurface({
  theme,
  mode,
  cvd = 'normal',
  highlightSemantics,
  pinnedSemantics,
  onHoverSemantics,
  onPinSemantics,
  compact = false,
}: PreviewSurfaceProps): JSX.Element {
  const style = inlineStyle(theme, mode, cvd);

  return (
    <div
      data-theme={mode}
      className="rounded-lg border overflow-hidden"
      style={{
        ...style,
        background: 'var(--color-background)',
        color: 'var(--color-foreground)',
        borderColor: 'var(--color-border)',
        fontFamily: 'var(--font-family-sans)',
      }}
    >
      <style>{`@keyframes workspace-theme-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }`}</style>
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-muted-foreground)' }}>
          {mode} preview
        </div>
        <div className="flex gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: 'var(--color-error)' }} />
          <span className="h-2 w-2 rounded-full" style={{ background: 'var(--color-warning)' }} />
          <span className="h-2 w-2 rounded-full" style={{ background: 'var(--color-success)' }} />
        </div>
      </div>

      <div className={compact ? 'p-4 space-y-4' : 'p-6 space-y-6'}>
        <HoverGroup ids={COMPONENT_USAGE.button!} highlight={highlightSemantics} pinned={pinnedSemantics} onHover={onHoverSemantics} onPin={onPinSemantics}>
          <div className="flex flex-wrap gap-2">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destroy</Button>
          </div>
        </HoverGroup>

        <HoverGroup ids={COMPONENT_USAGE.card!} highlight={highlightSemantics} pinned={pinnedSemantics} onHover={onHoverSemantics} onPin={onPinSemantics}>
          <Card>
            <CardHeader>
              <CardTitle>Project deploy summary</CardTitle>
              <CardDescription>Last build completed 2 minutes ago.</CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={68} />
              <div className="mt-3 flex items-center justify-between text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                <span>17 of 25 services healthy</span>
                <span>68%</span>
              </div>
            </CardContent>
          </Card>
        </HoverGroup>

        <HoverGroup ids={COMPONENT_USAGE.form!} highlight={highlightSemantics} pinned={pinnedSemantics} onHover={onHoverSemantics} onPin={onPinSemantics}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="preview-email">Email</Label>
              <Input id="preview-email" type="email" placeholder="you@company.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="preview-name">Display name</Label>
              <Input id="preview-name" placeholder="Acme Inc." />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="preview-tos" />
              <Label htmlFor="preview-tos">Accept terms of service</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="preview-notify" />
              <Label htmlFor="preview-notify">Email notifications</Label>
            </div>
          </div>
        </HoverGroup>

        <HoverGroup ids={COMPONENT_USAGE.badge!} highlight={highlightSemantics} pinned={pinnedSemantics} onHover={onHoverSemantics} onPin={onPinSemantics}>
          <div className="flex flex-wrap gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Destructive</Badge>
          </div>
        </HoverGroup>

        <HoverGroup ids={['primary', 'muted', 'foreground', 'muted-foreground', 'border']} highlight={highlightSemantics} pinned={pinnedSemantics} onHover={onHoverSemantics} onPin={onPinSemantics}>
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="mt-3 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
              The platform is healthy. Average latency is 142ms across 17 services.
            </TabsContent>
          </Tabs>
        </HoverGroup>

        <HoverGroup ids={COMPONENT_USAGE.alert!} highlight={highlightSemantics} pinned={pinnedSemantics} onHover={onHoverSemantics} onPin={onPinSemantics}>
          <Alert>
            <AlertTitle>Deployment ready</AlertTitle>
            <AlertDescription>Your branch is up to date and tests pass. Promote when ready.</AlertDescription>
          </Alert>
        </HoverGroup>

        <HoverGroup ids={COMPONENT_USAGE.table!} highlight={highlightSemantics} pinned={pinnedSemantics} onHover={onHoverSemantics} onPin={onPinSemantics}>
          <div
            className="rounded-md border text-xs"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <table className="w-full">
              <thead style={{ background: 'var(--color-muted)', color: 'var(--color-muted-foreground)' }}>
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Service</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-left font-medium">P95</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['api-gateway', 'healthy', '124ms'],
                  ['auth', 'healthy', '38ms'],
                  ['workers', 'degraded', '812ms'],
                ].map(([s, st, p]) => (
                  <tr key={s} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="px-3 py-2 font-mono">{s}</td>
                    <td className="px-3 py-2">
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full mr-1.5"
                        style={{
                          background: st === 'healthy' ? 'var(--color-success)' : 'var(--color-warning)',
                        }}
                      />
                      {st}
                    </td>
                    <td className="px-3 py-2 font-mono">{p}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </HoverGroup>
      </div>
    </div>
  );
}

export { COMPONENT_USAGE };
