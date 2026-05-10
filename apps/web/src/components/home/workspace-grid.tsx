'use client';

import type React from 'react';
import Link from 'next/link';

import { Card, CardContent } from '@/components/ui/card';

interface WorkspaceGridProps {
  workspaces: { id: string; slug: string; name: string }[];
  activeId: string | null;
  onSelect: (slug: string) => void;
  loading: boolean;
}

export function WorkspaceGrid({ workspaces, activeId, onSelect, loading }: WorkspaceGridProps): React.JSX.Element {
  if (loading) {
    return (
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-lg border bg-card h-24 animate-pulse"
            style={{ background: 'hsl(var(--color-muted) / 0.6)' }}
          />
        ))}
      </div>
    );
  }

  if (workspaces.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground space-y-3">
          <p>You don't belong to any workspaces yet.</p>
          <Link
            href="/workspaces?new=1"
            className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            + Create your first workspace
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
      {workspaces.map((ws) => {
        const isActive = ws.id === activeId;
        return (
          <button
            key={ws.id}
            type="button"
            onClick={() => onSelect(ws.slug)}
            className={`group relative flex flex-col gap-2 rounded-lg border p-4 text-left transition-colors ${
              isActive
                ? 'border-primary ring-2 ring-primary/40 bg-primary/5'
                : 'border-border hover:border-primary/40 hover:bg-muted/30'
            }`}
            aria-pressed={isActive}
          >
            <div className="flex items-center gap-2">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-md text-xs font-bold text-white"
                style={{ background: 'hsl(var(--color-primary))' }}
                aria-hidden="true"
              >
                {ws.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="text-sm font-semibold truncate">{ws.name}</span>
            </div>
            <span className="text-[11px] text-muted-foreground font-mono truncate">{ws.slug}</span>
            {isActive ? (
              <span className="absolute top-2 right-2 text-[9px] font-semibold uppercase tracking-wider text-primary">
                Active
              </span>
            ) : null}
          </button>
        );
      })}
      <Link
        href="/workspaces?new=1"
        className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed p-4 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary"
      >
        <span className="text-lg">+</span>
        New workspace
      </Link>
    </div>
  );
}
