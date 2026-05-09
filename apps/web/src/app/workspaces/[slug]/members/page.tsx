'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { InviteMemberDialog } from '@/components/workspace/invite-member-dialog';
import { MemberEventListener } from '@/components/workspace/member-event-listener';

interface Member {
  id: string;
  userId: string;
  displayName: string | null;
  email: string;
  status: string;
  roles: string[];
  joinedAt: string;
  lastSignIn: string | null;
}

const STATUS_CLASS: Record<string, string> = {
  active:
    'inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  pending:
    'inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  suspended:
    'inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive',
};

function statusBadgeClass(status: string): string {
  return (
    STATUS_CLASS[status] ??
    'inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground'
  );
}

export default function WorkspaceMembersPage() {
  const { slug } = useParams<{ slug: string }>();
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [activeTab, setActiveTab] = useState<'members' | 'pending'>('members');

  const loadMembers = useCallback(() => {
    void fetch(`/api/v1/workspaces/${slug}/members`, { credentials: 'include' })
      .then((r) => r.json() as Promise<{ items: Member[] }>)
      .then((d) => {
        setMembers(d.items);
        return;
      })
      .catch(() => {
        /* error handled by empty state */
      })
      .finally(() => {
        setLoading(false);
      });
  }, [slug]);

  useEffect(loadMembers, [loadMembers]);

  const filtered = members.filter(
    (m) =>
      !search ||
      (m.displayName?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      m.email.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-[1440px] p-6" style={{ maxWidth: 1280 }}>
      <MemberEventListener
        workspaceId={slug}
        onEvent={() => {
          loadMembers();
        }}
      />

      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1>Members</h1>
          <p className="subtitle">
            {String(members.length)} member{members.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            type="button"
            onClick={() => {
              setShowInvite(true);
            }}
          >
            + Invite member
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 2,
          marginBottom: 16,
        }}
      >
        {(['members', 'pending'] as const).map((tab) => (
          <Button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
            }}
            style={{
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: activeTab === tab ? 600 : 400,
              color: activeTab === tab ? 'var(--fg-primary)' : 'var(--fg-secondary)',
              background: 'none',
              border: 'none',
              borderBottom:
                activeTab === tab ? '2px solid var(--accent-primary)' : '2px solid transparent',
              cursor: 'pointer',
            }}
          >
            {tab === 'members' ? 'Members' : 'Pending invites'}
          </Button>
        ))}
      </div>

      {activeTab === 'members' && (
        <div className="rounded-md border bg-card text-card-foreground p-4">
          {/* Search */}
          <div style={{ padding: '12px 16px' }}>
            <input
              type="search"
              className="input input-h32"
              placeholder="Search members…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
              }}
              aria-label="Search members"
              style={{ width: 280 }}
            />
          </div>

          {loading && (
            <p
              style={{
                padding: '32px 16px',
                textAlign: 'center',
                fontSize: 13,
              }}
              aria-live="polite"
            >
              Loading…
            </p>
          )}

          {!loading && filtered.length === 0 && (
            <p
              style={{
                padding: '32px 16px',
                textAlign: 'center',
                fontSize: 13,
              }}
            >
              No members found.
            </p>
          )}

          {!loading && filtered.length > 0 && (
            <div className="overflow-hidden rounded-md border">
              <table className="w-full border-collapse text-sm" role="grid" aria-label="Members">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((member) => (
                    <tr key={member.id}>
                      <td>
                        <Link
                          href={`/workspaces/${slug}/members/${member.userId}`}
                          style={{
                            fontWeight: 500,
                            textDecoration: 'none',
                          }}
                        >
                          {member.displayName ?? member.email}
                        </Link>
                      </td>
                      <td>{member.email}</td>
                      <td>
                        <span className={statusBadgeClass(member.status)}>
                          {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                        </span>
                      </td>
                      <td>{new Date(member.joinedAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'pending' && (
        <div className="rounded-md border bg-card text-card-foreground p-4">
          <p
            style={{
              padding: '32px 16px',
              textAlign: 'center',
              fontSize: 13,
            }}
          >
            No pending invitations.
          </p>
        </div>
      )}

      <InviteMemberDialog
        slug={slug}
        open={showInvite}
        onClose={() => {
          setShowInvite(false);
        }}
      />
    </div>
  );
}
