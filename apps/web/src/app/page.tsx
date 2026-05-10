'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import type { ConversationSummary, WorkspaceSummary } from '@/lib/api-client';
import type { CustomerSchema } from '@/lib/types';

import { Button } from '@/components/ui/button';
import { Dialog, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '@/context/auth-context';
import { ApiClientError, conversationApi, schemaApi, workspaceApi } from '@/lib/api-client';

// ---------------------------------------------------------------------------
// Status badge map (conversation statuses from intent-capture service)
// ---------------------------------------------------------------------------

const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  active: {
    cls: 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400',
    label: 'In Progress',
  },
  brief_generated: {
    cls: 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400',
    label: 'In Review',
  },
  expired: {
    cls: 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground',
    label: 'Expired',
  },
};

const FALLBACK_BADGE = {
  cls: 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground',
  label: 'Unknown',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${String(mins)} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${String(hours)} hour${hours !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${String(days)} day${days !== 1 ? 's' : ''} ago`;
  return new Date(iso).toLocaleDateString();
}

function projectTitle(conv: ConversationSummary): string {
  if (conv.content.briefDraft.title) return conv.content.briefDraft.title;
  const firstMsg = conv.content.messages.at(0);
  if (firstMsg) return firstMsg.content.slice(0, 60);
  return 'Untitled project';
}

// ---------------------------------------------------------------------------
// New workspace dialog
// ---------------------------------------------------------------------------

const inputCls =
  'w-full h-9 px-3 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent';

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

interface NewWorkspaceDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (ws: WorkspaceSummary) => void;
}

function NewWorkspaceDialog({ open, onClose, onCreated }: NewWorkspaceDialogProps) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setSlug('');
      setSlugEdited(false);
      setError(null);
      setTimeout(() => nameRef.current?.focus(), 50);
    }
  }, [open]);

  function handleNameChange(val: string) {
    setName(val);
    if (!slugEdited) setSlug(toSlug(val));
  }

  function handleSlugChange(val: string) {
    setSlug(val.toLowerCase().replace(/[^a-z0-9-]/g, ''));
    setSlugEdited(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    if (!/^[a-z0-9-]+$/.test(slug)) {
      setError('Slug must contain only lowercase letters, numbers, and hyphens.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const ws = await workspaceApi.create({ name: name.trim(), slug: slug.trim() });
      onCreated(ws);
      onClose();
    } catch (err) {
      if (err instanceof ApiClientError && err.statusCode === 409) {
        setError('A workspace with this slug already exists. Choose a different slug.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to create workspace');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="New workspace" size="sm">
      <form
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="ws-name">
              Name
            </label>
            <input
              ref={nameRef}
              id="ws-name"
              className={inputCls}
              placeholder="Acme Corporation"
              value={name}
              onChange={(e) => {
                handleNameChange(e.target.value);
              }}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="ws-slug">
              Slug
            </label>
            <input
              id="ws-slug"
              className={inputCls}
              placeholder="acme-corporation"
              value={slug}
              onChange={(e) => {
                handleSlugChange(e.target.value);
              }}
              required
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Lowercase letters, numbers, and hyphens only.
            </p>
          </div>
          {error && <p className="text-[13px] text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={submitting || !name.trim() || !slug.trim()}>
            {submitting ? 'Creating…' : 'Create workspace'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Delete workspace dialog
// ---------------------------------------------------------------------------

interface DeleteWorkspaceDialogProps {
  workspace: WorkspaceSummary | null;
  onClose: () => void;
  onDeleted: (id: string) => void;
}

function DeleteWorkspaceDialog({ workspace, onClose, onDeleted }: DeleteWorkspaceDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspace) setError(null);
  }, [workspace]);

  async function handleConfirm() {
    if (!workspace) return;
    setDeleting(true);
    setError(null);
    try {
      await workspaceApi.delete(workspace.id);
      onDeleted(workspace.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete workspace');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={!!workspace} onClose={onClose} title="Delete workspace" size="sm">
      <div className="space-y-3">
        <p className="text-sm text-foreground">
          Are you sure you want to delete <span className="font-semibold">{workspace?.name}</span>?
          This action cannot be undone.
        </p>
        {error && <p className="text-[13px] text-destructive">{error}</p>}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={deleting}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          onClick={() => {
            void handleConfirm();
          }}
          disabled={deleting}
        >
          {deleting ? 'Deleting…' : 'Delete workspace'}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Switch workspace dialog
// ---------------------------------------------------------------------------

interface SwitchWorkspaceDialogProps {
  open: boolean;
  onClose: () => void;
  workspaces: WorkspaceSummary[];
  currentId: string | undefined;
  onSelect: (ws: WorkspaceSummary) => void;
}

function SwitchWorkspaceDialog({
  open,
  onClose,
  workspaces,
  currentId,
  onSelect,
}: SwitchWorkspaceDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title="Workspaces" size="sm">
      {workspaces.length === 0 ? (
        <p className="text-sm text-muted-foreground">No workspaces found.</p>
      ) : (
        <div className="space-y-1">
          {workspaces.map((ws) => {
            const isActive = ws.id === currentId;
            return (
              <button
                key={ws.id}
                type="button"
                onClick={() => {
                  onSelect(ws);
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-sm transition-colors hover:bg-muted ${isActive ? 'bg-muted' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded flex items-center justify-center text-[11px] font-bold text-white bg-primary flex-shrink-0">
                    {ws.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="text-left">
                    <div className={`font-medium ${isActive ? 'text-primary' : 'text-foreground'}`}>
                      {ws.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono">{ws.slug}</div>
                  </div>
                </div>
                {isActive && <span className="text-[11px] font-medium text-primary">Active</span>}
              </button>
            );
          })}
        </div>
      )}
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function StatSkeleton() {
  return (
    <div className="bg-card border border-border rounded-md px-4 py-3.5 animate-pulse">
      <div className="h-2.5 w-24 bg-muted rounded mb-3" />
      <div className="h-6 w-12 bg-muted rounded mb-2" />
      <div className="h-2 w-20 bg-muted rounded" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HomePage() {
  const { user } = useAuth();
  const firstName = user?.displayName?.split(' ')[0] ?? null;

  const [allWorkspaces, setAllWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [schemas, setSchemas] = useState<CustomerSchema[]>([]);
  const [loading, setLoading] = useState(true);
  const [newWsOpen, setNewWsOpen] = useState(false);
  const [switchWsOpen, setSwitchWsOpen] = useState(false);
  const [wsToDelete, setWsToDelete] = useState<WorkspaceSummary | null>(null);

  async function loadWorkspaceData(ws: WorkspaceSummary) {
    const [convData, schemaData] = await Promise.all([
      conversationApi.list(ws.id, { limit: 20 }),
      schemaApi
        .list(ws.id)
        .catch(() => ({ items: [] as CustomerSchema[], total: 0, hasNextPage: false })),
    ]);
    setConversations(convData.items);
    setSchemas(schemaData.items);
  }

  function selectWorkspace(ws: WorkspaceSummary) {
    setWorkspace(ws);
    setConversations([]);
    setSchemas([]);
    void loadWorkspaceData(ws);
  }

  function handleWorkspaceCreated(ws: WorkspaceSummary) {
    setAllWorkspaces((prev) => [...prev, ws]);
    selectWorkspace(ws);
  }

  function handleWorkspaceDeleted(id: string) {
    setAllWorkspaces((prev) => {
      const next = prev.filter((w) => w.id !== id);
      if (workspace?.id === id) {
        const fallback = next.at(-1) ?? null;
        setWorkspace(fallback);
        setConversations([]);
        setSchemas([]);
        if (fallback) void loadWorkspaceData(fallback);
      }
      return next;
    });
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const wsData = await workspaceApi.list();
        if (cancelled) return;
        setAllWorkspaces(wsData.items);

        const ws = wsData.items.at(-1) ?? null;
        setWorkspace(ws);

        if (ws) {
          const [convData, schemaData] = await Promise.all([
            conversationApi.list(ws.id, { limit: 20 }),
            schemaApi
              .list(ws.id)
              .catch(() => ({ items: [] as CustomerSchema[], total: 0, hasNextPage: false })),
          ]);
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          if (!cancelled) {
            setConversations(convData.items);
            setSchemas(schemaData.items);
          }
        }
      } catch {
        // leave state empty — components render empty states
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const tableCount = schemas.reduce((sum, s) => sum + s.tables.length, 0);
  const aiSpend = conversations.reduce((sum, c) => sum + (c.content.totalCostUsd ?? 0), 0);
  const recentConversations = conversations.slice(0, 5);

  return (
    <div className="max-w-[1280px] mx-auto p-6">
      <div className="flex items-start justify-between mb-5 gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground m-0">
            Welcome back{firstName ? `, ${firstName}` : ''}
          </h1>
          <div className="text-[13px] text-muted-foreground mt-1">
            {workspace ? `Workspace: ${workspace.name}` : 'Loading workspace…'}
          </div>
        </div>
        <div className="flex gap-2 items-center flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSwitchWsOpen(true);
            }}
          >
            Switch workspace
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setNewWsOpen(true);
            }}
          >
            + New workspace
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {loading ? (
          <>
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </>
        ) : (
          <>
            <div className="bg-card border border-border rounded-md px-4 py-3.5">
              <div className="text-[11px] uppercase tracking-[0.04em] text-muted-foreground mb-1.5 font-semibold">
                Active projects
              </div>
              <div className="text-[22px] font-semibold tabular-nums text-foreground">
                {conversations.filter((c) => c.status === 'active').length}
              </div>
              <div className="text-[11px] mt-1 text-muted-foreground">
                {conversations.length} total
              </div>
            </div>
            <div className="bg-card border border-border rounded-md px-4 py-3.5">
              <div className="text-[11px] uppercase tracking-[0.04em] text-muted-foreground mb-1.5 font-semibold">
                Database tables
              </div>
              <div className="text-[22px] font-semibold tabular-nums text-foreground">
                {tableCount}
              </div>
              <div className="text-[11px] mt-1 text-muted-foreground">
                {schemas.length} schema{schemas.length !== 1 ? 's' : ''}
              </div>
            </div>
            <div className="bg-card border border-border rounded-md px-4 py-3.5">
              <div className="text-[11px] uppercase tracking-[0.04em] text-muted-foreground mb-1.5 font-semibold">
                API requests · 24h
              </div>
              <div className="text-[22px] font-semibold tabular-nums text-foreground">&mdash;</div>
              <div className="text-[11px] mt-1 text-muted-foreground">Not yet tracked</div>
            </div>
            <div className="bg-card border border-border rounded-md px-4 py-3.5">
              <div className="text-[11px] uppercase tracking-[0.04em] text-muted-foreground mb-1.5 font-semibold">
                AI spend · all time
              </div>
              <div className="text-[22px] font-semibold tabular-nums text-foreground">
                ${aiSpend.toFixed(2)}
              </div>
              <div className="text-[11px] mt-1 text-muted-foreground">
                across {conversations.length} projects
              </div>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-[2fr_1fr] gap-4 mb-4">
        {/* Recent projects */}
        <div className="bg-card border border-border rounded-md p-4">
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-border">
            <div className="font-semibold text-sm text-foreground">Recent projects</div>
            <Link href="/ai-pipeline/intent-capture">
              <Button variant="ghost" size="sm">
                View all
              </Button>
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-muted rounded" />
              ))}
            </div>
          ) : recentConversations.length === 0 ? (
            <div className="text-center py-8 text-[13px] text-muted-foreground">
              No projects yet.{' '}
              <Link href="/ai-pipeline/intent-capture" className="text-primary underline">
                Start your first project
              </Link>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-md overflow-hidden">
              <table className="w-full border-collapse">
                <tbody>
                  {recentConversations.map((conv) => {
                    const badge = STATUS_BADGE[conv.status] ?? FALLBACK_BADGE;
                    return (
                      <tr
                        key={conv.id}
                        className="cursor-pointer hover:bg-muted border-b border-border last:border-0"
                      >
                        <td className="h-10 px-3 align-middle">
                          <Link
                            href={`/ai-pipeline/intent-capture`}
                            className="font-semibold text-foreground no-underline"
                          >
                            {projectTitle(conv)}
                          </Link>
                        </td>
                        <td className="h-10 px-3 align-middle">
                          <span className={badge.cls}>{badge.label}</span>
                        </td>
                        <td className="h-10 px-3 align-middle tabular-nums text-xs text-muted-foreground">
                          {new Date(conv.createdAt).toLocaleDateString()}
                        </td>
                        <td className="h-10 px-3 align-middle tabular-nums text-xs text-muted-foreground">
                          ${(conv.content.totalCostUsd ?? 0).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent activity (derived from conversations) */}
        <div className="bg-card border border-border rounded-md p-4">
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-border">
            <div className="font-semibold text-sm text-foreground">Recent activity</div>
          </div>
          {loading ? (
            <div className="space-y-4 animate-pulse px-4 pb-4">
              {[1, 2, 3].map((i) => (
                <div key={i}>
                  <div className="h-3 w-48 bg-muted rounded mb-1.5" />
                  <div className="h-2 w-32 bg-muted rounded" />
                </div>
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="px-4 pb-4 text-[13px] text-muted-foreground">No recent activity.</div>
          ) : (
            <div className="px-4 pb-4 text-[13px]">
              {conversations.slice(0, 5).map((conv) => (
                <div key={conv.id} className="mb-4">
                  <div className="font-medium text-foreground">
                    {conv.status === 'brief_generated'
                      ? `Brief generated: ${projectTitle(conv)}`
                      : `Project started: ${projectTitle(conv)}`}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {relativeTime(conv.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Workspaces */}
      <div className="bg-card border border-border rounded-md p-4 mb-4">
        <div className="flex items-center justify-between mb-3 pb-3 border-b border-border">
          <div className="font-semibold text-sm text-foreground">Workspaces</div>
          <Button
            size="sm"
            onClick={() => {
              setNewWsOpen(true);
            }}
          >
            + New workspace
          </Button>
        </div>
        {loading ? (
          <div className="space-y-2 animate-pulse px-0 pb-1">
            {[1, 2].map((i) => (
              <div key={i} className="h-10 bg-muted rounded" />
            ))}
          </div>
        ) : allWorkspaces.length === 0 ? (
          <p className="text-[13px] text-muted-foreground py-2">No workspaces found.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {allWorkspaces.map((ws) => {
              const isActive = ws.id === workspace?.id;
              return (
                <div
                  key={ws.id}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:bg-muted group ${isActive ? 'bg-muted' : ''}`}
                >
                  <Link
                    href={`/workspaces/${ws.slug}`}
                    onClick={() => {
                      selectWorkspace(ws);
                    }}
                    className="flex items-center gap-3 flex-1 min-w-0 no-underline"
                  >
                    <div className="h-7 w-7 rounded flex items-center justify-center text-[11px] font-bold text-white bg-primary flex-shrink-0">
                      {ws.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-sm font-medium truncate ${isActive ? 'text-primary' : 'text-foreground'}`}
                      >
                        {ws.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono">{ws.slug}</div>
                    </div>
                    {isActive && (
                      <span className="text-[11px] font-medium text-primary flex-shrink-0">
                        Active
                      </span>
                    )}
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setWsToDelete(ws);
                    }}
                    className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                    aria-label={`Delete ${ws.name}`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick start */}
      <div className="bg-card border border-border rounded-md p-4">
        <div className="flex items-center justify-between mb-3 pb-3 border-b border-border">
          <div className="font-semibold text-sm text-foreground">Quick start</div>
        </div>
        <div className="grid grid-cols-3 gap-4 px-4 pb-4">
          {[
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
          ].map((item) => (
            <Link key={item.href} href={item.href} className="no-underline text-inherit">
              <div className="bg-card border border-border rounded-md p-4 cursor-pointer hover:bg-muted transition-colors">
                <div className="text-lg text-primary">{item.icon}</div>
                <div className="font-semibold mt-2 text-foreground">{item.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{item.description}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <NewWorkspaceDialog
        open={newWsOpen}
        onClose={() => {
          setNewWsOpen(false);
        }}
        onCreated={handleWorkspaceCreated}
      />

      <SwitchWorkspaceDialog
        open={switchWsOpen}
        onClose={() => {
          setSwitchWsOpen(false);
        }}
        workspaces={allWorkspaces}
        currentId={workspace?.id}
        onSelect={selectWorkspace}
      />

      <DeleteWorkspaceDialog
        workspace={wsToDelete}
        onClose={() => {
          setWsToDelete(null);
        }}
        onDeleted={handleWorkspaceDeleted}
      />
    </div>
  );
}
