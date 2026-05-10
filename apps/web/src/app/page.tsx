'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/auth-context';

interface Project {
  id: string;
  name: string;
  status: 'active' | 'live' | 'in_review' | 'pending' | 'failed';
  created: string;
  cost: number;
  stage: string;
}

const PROJECTS: Project[] = [
  {
    id: 'crm-001',
    name: 'Internal Sales CRM',
    status: 'active',
    created: '2026-04-15',
    cost: 23.4,
    stage: 'ui-generation',
  },
  {
    id: 'blog-001',
    name: 'Marketing Blog',
    status: 'live',
    created: '2026-02-08',
    cost: 41.2,
    stage: 'maintenance',
  },
];

const STATUS_BADGE: Record<Project['status'], { cls: string; label: string }> = {
  active: {
    cls: 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400',
    label: 'In Progress',
  },
  live: {
    cls: 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    label: 'Live',
  },
  in_review: {
    cls: 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400',
    label: 'In Review',
  },
  pending: {
    cls: 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground',
    label: 'Pending',
  },
  failed: {
    cls: 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-destructive/10 text-destructive',
    label: 'Failed',
  },
};

const RECENT_ACTIVITY = [
  { title: 'UI generated for Internal Sales CRM', detail: '14 components · $18.50 · 12 min ago' },
  { title: 'Schema deployed to dev', detail: 'Marketing Blog · 2 hours ago' },
  { title: 'PRD section approved', detail: 'Functional Requirements · Yesterday' },
];

const QUICK_START = [
  {
    icon: '▦',
    label: 'Table Editor',
    description: 'Browse and edit your data',
    href: '/data-management',
  },
  {
    icon: '◰',
    label: 'Schema Designer',
    description: 'Design your database visually',
    href: '/schema-designer',
  },
  {
    icon: '✦',
    label: 'AI Pipeline',
    description: 'Build with the AI loop',
    href: '/ai-pipeline/intent-capture',
  },
];

export default function HomePage() {
  const { user } = useAuth();
  const firstName = user?.displayName?.split(' ')[0] ?? null;

  return (
    <div className="max-w-[1280px] mx-auto p-6">
      <div className="flex items-start justify-between mb-5 gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground m-0">
            Welcome back{firstName ? `, ${firstName}` : ''}
          </h1>
          <div className="text-[13px] text-muted-foreground mt-1">
            Workspace: Acme Corporation · Database: PostgreSQL
          </div>
        </div>
        <div className="flex gap-2 items-center flex-shrink-0">
          <Link href="/workspaces">
            <Button variant="outline" size="sm">Switch workspace</Button>
          </Link>
          <Link href="/ai-pipeline/intent-capture">
            <Button size="sm">+ New project</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-card border border-border rounded-md px-4 py-3.5">
          <div className="text-[11px] uppercase tracking-[0.04em] text-muted-foreground mb-1.5 font-semibold">Active projects</div>
          <div className="text-[22px] font-semibold tabular-nums text-foreground">{PROJECTS.length}</div>
          <div className="text-[11px] mt-1 text-emerald-600 dark:text-emerald-400">+1 this month</div>
        </div>
        <div className="bg-card border border-border rounded-md px-4 py-3.5">
          <div className="text-[11px] uppercase tracking-[0.04em] text-muted-foreground mb-1.5 font-semibold">Database tables</div>
          <div className="text-[22px] font-semibold tabular-nums text-foreground">21</div>
          <div className="text-[11px] mt-1 text-emerald-600 dark:text-emerald-400">+4 this week</div>
        </div>
        <div className="bg-card border border-border rounded-md px-4 py-3.5">
          <div className="text-[11px] uppercase tracking-[0.04em] text-muted-foreground mb-1.5 font-semibold">API requests · 24h</div>
          <div className="text-[22px] font-semibold tabular-nums text-foreground">142,503</div>
          <div className="text-[11px] mt-1 text-muted-foreground">p95 87ms</div>
        </div>
        <div className="bg-card border border-border rounded-md px-4 py-3.5">
          <div className="text-[11px] uppercase tracking-[0.04em] text-muted-foreground mb-1.5 font-semibold">AI spend · month</div>
          <div className="text-[22px] font-semibold tabular-nums text-foreground">$23.40</div>
          <div className="text-[11px] mt-1 text-muted-foreground">of $50 budget</div>
        </div>
      </div>

      <div className="grid grid-cols-[2fr_1fr] gap-4 mb-4">
        <div className="bg-card border border-border rounded-md p-4">
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-border">
            <div className="font-semibold text-sm text-foreground">Recent projects</div>
            <Link href="/ai-pipeline">
              <Button variant="ghost" size="sm">View all</Button>
            </Link>
          </div>
          <div className="bg-card border border-border rounded-md overflow-hidden">
            <table className="w-full border-collapse">
              <tbody>
                {PROJECTS.map((p) => {
                  const s = STATUS_BADGE[p.status];
                  return (
                    <tr key={p.id} className="cursor-pointer hover:bg-muted border-b border-border last:border-0">
                      <td className="h-10 px-3 align-middle">
                        <Link
                          href={`/ai-pipeline/${p.stage}`}
                          className="font-semibold text-foreground no-underline"
                        >
                          {p.name}
                        </Link>
                      </td>
                      <td className="h-10 px-3 align-middle">
                        <span className={s.cls}>{s.label}</span>
                      </td>
                      <td className="h-10 px-3 align-middle tabular-nums text-xs text-muted-foreground">
                        {p.created}
                      </td>
                      <td className="h-10 px-3 align-middle tabular-nums text-xs text-muted-foreground">
                        ${p.cost.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-card border border-border rounded-md p-4">
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-border">
            <div className="font-semibold text-sm text-foreground">Recent activity</div>
          </div>
          <div className="px-4 pb-4 text-[13px]">
            {RECENT_ACTIVITY.map((a, i) => (
              <div key={i} className="mb-4">
                <div className="font-medium text-foreground">{a.title}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{a.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-md p-4">
        <div className="flex items-center justify-between mb-3 pb-3 border-b border-border">
          <div className="font-semibold text-sm text-foreground">Quick start</div>
        </div>
        <div className="grid grid-cols-3 gap-4 px-4 pb-4">
          {QUICK_START.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="no-underline text-inherit"
            >
              <div className="bg-card border border-border rounded-md p-4 cursor-pointer">
                <div className="text-lg text-primary">{item.icon}</div>
                <div className="font-semibold mt-2 text-foreground">{item.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{item.description}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
