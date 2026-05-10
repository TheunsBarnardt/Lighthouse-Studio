'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';

import { useMyWorkspaces } from './useWorkspaces';

const STORAGE_KEY = 'lh.activeWorkspaceSlug';

interface ActiveWorkspaceShape {
  id: string;
  slug: string;
  name: string;
}

export interface UseActiveWorkspaceResult {
  active: ActiveWorkspaceShape | null;
  workspaces: ActiveWorkspaceShape[];
  loading: boolean;
  setActiveBySlug: (slug: string) => void;
}

function readStored(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(slug: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (slug) window.localStorage.setItem(STORAGE_KEY, slug);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function slugFromPath(pathname: string | null): string | null {
  if (!pathname) return null;
  const m = /^\/workspaces\/([^/]+)/.exec(pathname);
  return m ? (m[1] as string) : null;
}

export function useActiveWorkspace(): UseActiveWorkspaceResult {
  const pathname = usePathname();
  const query = useMyWorkspaces();
  const [stored, setStored] = useState<string | null>(() => readStored());

  useEffect(() => {
    const fromUrl = slugFromPath(pathname);
    if (fromUrl && fromUrl !== stored) {
      setStored(fromUrl);
      writeStored(fromUrl);
    }
  }, [pathname, stored]);

  const workspaces: ActiveWorkspaceShape[] = useMemo(() => {
    const items = query.data?.items ?? [];
    return items.map((w) => ({ id: w.id, slug: w.slug, name: w.name }));
  }, [query.data]);

  const active = useMemo<ActiveWorkspaceShape | null>(() => {
    if (workspaces.length === 0) return null;
    const fromUrl = slugFromPath(pathname);
    const candidates = [fromUrl, stored].filter((v): v is string => Boolean(v));
    for (const slug of candidates) {
      const match = workspaces.find((w) => w.slug === slug);
      if (match) return match;
    }
    return workspaces[0] ?? null;
  }, [pathname, stored, workspaces]);

  function setActiveBySlug(slug: string): void {
    setStored(slug);
    writeStored(slug);
  }

  return { active, workspaces, loading: query.isLoading, setActiveBySlug };
}
