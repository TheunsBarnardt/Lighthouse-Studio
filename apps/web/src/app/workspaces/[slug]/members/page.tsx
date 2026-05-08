'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

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
  active: 'pg-badge pg-badge-success',
  pending: 'pg-badge pg-badge-warning',
  suspended: 'pg-badge pg-badge-danger',
};

function statusBadgeClass(status: string): string {
  return STATUS_CLASS[status] ?? 'pg-badge pg-badge-default';
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
    <div className="pg-page" style={{ maxWidth: 1280 }}>
      <MemberEventListener
        workspaceId={slug}
        onEvent={() => {
          loadMembers();
        }}
      />

      <div className="pg-page-header">
        <div>
          <h1>Members</h1>
          <p className="subtitle">
            {String(members.length)} member{members.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="pg-page-header-actions">
          <button
            className="pg-btn pg-btn-primary pg-btn-sm"
            onClick={() => {
              setShowInvite(true);
            }}
          >
            + Invite member
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 2,
          marginBottom: 16,
          borderBottom: '1px solid var(--border-default)',
        }}
      >
        {(['members', 'pending'] as const).map((tab) => (
          <button
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
          </button>
        ))}
      </div>

      {activeTab === 'members' && (
        <div className="pg-card">
          {/* Search */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-default)' }}>
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
                color: 'var(--fg-secondary)',
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
                color: 'var(--fg-secondary)',
              }}
            >
              No members found.
            </p>
          )}

          {!loading && filtered.length > 0 && (
            <div className="pg-table-wrap">
              <table className="pg-data-table" role="grid" aria-label="Members">
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
                            color: 'var(--fg-primary)',
                            textDecoration: 'none',
                          }}
                        >
                          {member.displayName ?? member.email}
                        </Link>
                      </td>
                      <td style={{ color: 'var(--fg-secondary)' }}>{member.email}</td>
                      <td>
                        <span className={statusBadgeClass(member.status)}>
                          {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                        </span>
                      </td>
                      <td style={{ color: 'var(--fg-secondary)' }}>
                        {new Date(member.joinedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'pending' && (
        <div className="pg-card">
          <p
            style={{
              padding: '32px 16px',
              textAlign: 'center',
              fontSize: 13,
              color: 'var(--fg-secondary)',
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
