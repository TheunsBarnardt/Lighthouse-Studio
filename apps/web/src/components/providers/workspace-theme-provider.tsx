'use client';

import type React from 'react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

import type { WorkspaceTheme } from '@/lib/theme/types';
import { WorkspaceThemeSchema } from '@/lib/theme/types';
import { resolveMode } from '@/lib/theme/serialize';

const STYLE_ID = 'workspace-theme-vars';

function buildCss(theme: WorkspaceTheme): string {
  const light = resolveMode(theme, 'light');
  const dark = resolveMode(theme, 'dark');
  const lines: string[] = [];
  // Light: only when the root does NOT have the .dark class (Tailwind v4 dark mode)
  lines.push(':root:not(.dark) [data-workspace-themed="true"],\n[data-workspace-themed="true"] [data-theme="light"] {');
  for (const [k, v] of Object.entries(light.vars)) lines.push(`  ${k}: ${v};`);
  lines.push('}');
  // Dark: when .dark is on root, or an explicit data-theme="dark" wrapper is present
  lines.push('.dark [data-workspace-themed="true"],\n[data-workspace-themed="true"][data-theme="dark"],\n[data-workspace-themed="true"] [data-theme="dark"] {');
  for (const [k, v] of Object.entries(dark.vars)) lines.push(`  ${k}: ${v};`);
  lines.push('}');
  return lines.join('\n');
}

function extractWorkspaceSlug(pathname: string | null): string | null {
  if (!pathname) return null;
  const m = /^\/workspaces\/([^/]+)/.exec(pathname);
  return m ? m[1]! : null;
}

export function WorkspaceThemeProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const pathname = usePathname();
  const slug = extractWorkspaceSlug(pathname);
  const [theme, setTheme] = useState<WorkspaceTheme | null>(null);

  useEffect(() => {
    if (!slug) {
      setTheme(null);
      return;
    }
    let cancelled = false;
    void fetch(`/api/v1/workspaces/${slug}/theme`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: unknown) => {
        if (cancelled || !json) return undefined;
        const parsed = WorkspaceThemeSchema.safeParse(json);
        if (parsed.success) setTheme(parsed.data);
        return undefined;
      })
      .catch(() => {
        /* fall back to platform defaults */
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const css = useMemo(() => (theme ? buildCss(theme) : ''), [theme]);

  return (
    <div data-workspace-themed={theme ? 'true' : 'false'} style={{ display: 'contents' }}>
      {css ? <style id={STYLE_ID} dangerouslySetInnerHTML={{ __html: css }} /> : null}
      {children}
    </div>
  );
}
