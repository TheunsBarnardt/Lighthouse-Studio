'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

interface MemberDetail {
  id: string;
  email: string;
  displayName: string | null;
  status: string;
  roles: string[];
  identities: Array<{ providerId: string; email: string }>;
}

type TabKey = 'profile' | 'roles' | 'identities' | 'sessions' | 'activity';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'profile', label: 'Profile' },
  { key: 'roles', label: 'Roles' },
  { key: 'identities', label: 'Identities' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'activity', label: 'Activity' },
];

export default function MemberDetailPage() {
  const { slug, userId } = useParams<{ slug: string; userId: string }>();
  const [member, setMember] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('profile');

  useEffect(() => {
    void fetch(`/api/v1/workspaces/${slug}/members/${userId}`, { credentials: 'include' })
      .then((r) => r.json() as Promise<MemberDetail>)
      .then(setMember)
      .catch(() => {
        /* show not found */
      })
      .finally(() => {
        setLoading(false);
      });
  }, [slug, userId]);

  if (loading)
    return (
      <div style={{ padding: '16px 24px', fontSize: 13 }} aria-live="polite">
        Loading…
      </div>
    );
  if (!member) return <div style={{ padding: '16px 24px', fontSize: 13 }}>Member not found.</div>;

  return (
    <div style={{ padding: '16px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link href={`/workspaces/${slug}/members`} style={{ fontSize: 13, textDecoration: 'none' }}>
          ← Members
        </Link>
        <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
          {member.displayName ?? member.email}
        </h1>
      </div>

      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          marginBottom: 20,
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
            }}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: activeTab === tab.key ? 600 : 400,
              color: activeTab === tab.key ? 'var(--fg-primary)' : 'var(--fg-secondary)',
              background: 'none',
              border: 'none',
              borderBottom:
                activeTab === tab.key ? '2px solid var(--accent-primary)' : '2px solid transparent',
              cursor: 'pointer',
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && (
        <div className="rounded-md border bg-card text-card-foreground p-4">
          <div className="mb-3 flex items-center justify-between border-b pb-3">
            <span className="text-sm font-semibold">Profile</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            <div className="flex items-center justify-between border-b py-1.5 text-sm last:border-b-0">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{member.email}</span>
            </div>
            <div className="flex items-center justify-between border-b py-1.5 text-sm last:border-b-0">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium">{member.status}</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'roles' && (
        <div className="rounded-md border bg-card text-card-foreground p-4">
          <div className="mb-3 flex items-center justify-between border-b pb-3">
            <span className="text-sm font-semibold">Roles</span>
          </div>
          <div style={{ marginTop: 12 }}>
            {member.roles.length === 0 ? (
              <p style={{ fontSize: 13 }}>No roles assigned.</p>
            ) : (
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                {member.roles.map((r) => (
                  <li key={r} style={{ fontSize: 13 }}>
                    {r}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {activeTab === 'identities' && (
        <div className="rounded-md border bg-card text-card-foreground p-4">
          <div className="mb-3 flex items-center justify-between border-b pb-3">
            <span className="text-sm font-semibold">Linked identities</span>
          </div>
          <div style={{ marginTop: 12 }}>
            {member.identities.length === 0 ? (
              <p style={{ fontSize: 13 }}>No identities.</p>
            ) : (
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                {member.identities.map((i) => (
                  <li key={i.providerId} style={{ fontSize: 13 }}>
                    <span className="font-mono text-sm" style={{ fontSize: 11 }}>
                      {i.providerId}:
                    </span>{' '}
                    {i.email}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {activeTab === 'sessions' && (
        <div className="rounded-md border bg-card text-card-foreground p-4">
          <div className="mb-3 flex items-center justify-between border-b pb-3">
            <span className="text-sm font-semibold">Sessions</span>
          </div>
          <p style={{ marginTop: 12, fontSize: 13 }}>Session management coming soon.</p>
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="rounded-md border bg-card text-card-foreground p-4">
          <div className="mb-3 flex items-center justify-between border-b pb-3">
            <span className="text-sm font-semibold">Activity history</span>
          </div>
          <p style={{ marginTop: 12, fontSize: 13 }}>Activity log coming soon.</p>
        </div>
      )}
    </div>
  );
}
