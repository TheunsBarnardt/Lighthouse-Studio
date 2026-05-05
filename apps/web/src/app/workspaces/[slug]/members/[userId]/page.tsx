'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface MemberDetail {
  id: string;
  email: string;
  displayName: string | null;
  status: string;
  roles: string[];
  identities: Array<{ providerId: string; email: string }>;
}

export default function MemberDetailPage() {
  const { slug, userId } = useParams<{ slug: string; userId: string }>();
  const [member, setMember] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch(`/api/v1/workspaces/${slug}/members/${userId}`, { credentials: 'include' })
      .then((r) => r.json() as Promise<MemberDetail>)
      .then(setMember)
      .catch(() => { /* show not found */ })
      .finally(() => { setLoading(false); });
  }, [slug, userId]);

  if (loading) return <p className="text-sm text-muted-foreground" aria-live="polite">Loading…</p>;
  if (!member) return <p className="text-sm text-muted-foreground">Member not found.</p>;

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <Link href={`/workspaces/${slug}/members`} className="text-sm text-muted-foreground hover:text-primary">
          ← Members
        </Link>
        <h1 className="text-2xl font-bold">{member.displayName ?? member.email}</h1>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="mb-4">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="identities">Identities</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm"><span className="font-medium">Email:</span> {member.email}</p>
              <p className="text-sm"><span className="font-medium">Status:</span> {member.status}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles">
          <Card>
            <CardHeader><CardTitle>Roles</CardTitle></CardHeader>
            <CardContent>
              {member.roles.length === 0
                ? <p className="text-sm text-muted-foreground">No roles assigned.</p>
                : <ul className="space-y-1">{member.roles.map((r) => <li key={r} className="text-sm">{r}</li>)}</ul>
              }
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="identities">
          <Card>
            <CardHeader><CardTitle>Linked identities</CardTitle></CardHeader>
            <CardContent>
              {member.identities.length === 0
                ? <p className="text-sm text-muted-foreground">No identities.</p>
                : <ul className="space-y-1">{member.identities.map((i) => (
                    <li key={i.providerId} className="text-sm">{i.providerId}: {i.email}</li>
                  ))}</ul>
              }
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions">
          <Card>
            <CardHeader><CardTitle>Sessions</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">Session management coming soon.</p></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader><CardTitle>Activity history</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">Activity log coming soon.</p></CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
