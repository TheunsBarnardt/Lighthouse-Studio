'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import type { WorkspaceSummary } from '@/lib/api-client';

import { Button } from '@/components/ui/button';
import { workspaceApi } from '@/lib/api-client';

function WorkspacesSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 animate-pulse"
        >
          <div className="h-10 w-10 rounded-md bg-muted flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-48 rounded bg-muted" />
            <div className="h-3 w-32 rounded bg-muted" />
          </div>
          <div className="h-8 w-16 rounded-md bg-muted" />
        </div>
      ))}
    </div>
  );
}

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const d = await workspaceApi.list();
        setWorkspaces(d.items);
      } catch {
        setError('Failed to load workspaces.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="mx-auto max-w-[1280px] p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Workspaces</h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            {loading
              ? 'Loading…'
              : `${String(workspaces.length)} workspace${workspaces.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Link href="/">
          <Button size="sm">+ New workspace</Button>
        </Link>
      </div>

      {loading ? (
        <WorkspacesSkeleton />
      ) : error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : workspaces.length === 0 ? (
        <div className="rounded-md border border-border bg-card p-12 text-center">
          <p className="font-medium text-foreground mb-1">No workspaces yet</p>
          <p className="text-[13px] text-muted-foreground mb-4">
            Create your first workspace to get started.
          </p>
          <Link href="/">
            <Button size="sm">+ New workspace</Button>
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              className="flex items-center gap-4 rounded-lg border border-border bg-card p-4"
            >
              <div className="h-10 w-10 rounded-md bg-primary flex items-center justify-center text-[13px] font-bold text-white flex-shrink-0">
                {ws.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-foreground truncate">{ws.name}</p>
                <p className="text-[12px] text-muted-foreground mt-0.5 font-mono">{ws.slug}</p>
              </div>
              <p className="text-[12px] text-muted-foreground flex-shrink-0">
                {new Date(ws.createdAt).toLocaleDateString()}
              </p>
              <Link href="/">
                <Button variant="outline" size="sm">
                  Open
                </Button>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
