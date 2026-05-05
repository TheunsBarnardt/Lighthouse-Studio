'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AdminUserDetail {
  id: string;
  email: string;
  displayName: string | null;
  status: string;
  mfaEnabled: boolean;
  roles: string[];
  identities: Array<{ providerId: string; email: string }>;
  createdAt: string;
  lastSignIn: string | null;
}

export default function AdminUserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch(`/api/v1/admin/users/${userId}`, { credentials: 'include' });
        const d = (await r.json()) as AdminUserDetail;
        setUser(d);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  async function patch(updates: Record<string, unknown>) {
    setActionMsg(null);
    const res = await fetch(`/api/v1/admin/users/${userId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const body = (await res.json()) as { message?: string };
      setActionMsg({ kind: 'error', text: body.message ?? 'Action failed.' });
      return;
    }
    setUser((u) => u ? { ...u, ...updates } as AdminUserDetail : u);
    setActionMsg({ kind: 'success', text: 'Updated.' });
  }

  if (loading) return <p className="text-sm text-muted-foreground" aria-live="polite">Loading…</p>;
  if (!user) return <p className="text-sm text-muted-foreground">User not found.</p>;

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <Link href="/admin/users" className="text-sm text-muted-foreground hover:text-primary">
          ← Users
        </Link>
        <h1 className="text-2xl font-bold">{user.displayName ?? user.email}</h1>
        <Badge variant="secondary">{user.status}</Badge>
      </div>

      {actionMsg && (
        <Alert variant={actionMsg.kind === 'error' ? 'destructive' : 'default'} className="mb-4">
          <AlertDescription>{actionMsg.text}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm"><span className="font-medium">Email:</span> {user.email}</p>
            <p className="text-sm"><span className="font-medium">Display name:</span> {user.displayName ?? '—'}</p>
            <p className="text-sm"><span className="font-medium">MFA:</span> {user.mfaEnabled ? 'Enabled' : 'Disabled'}</p>
            <p className="text-sm">
              <span className="font-medium">Joined:</span> {new Date(user.createdAt).toLocaleDateString()}
            </p>
            <p className="text-sm">
              <span className="font-medium">Last sign-in:</span>{' '}
              {user.lastSignIn ? new Date(user.lastSignIn).toLocaleString() : 'Never'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {user.status === 'active' ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => { void patch({ status: 'suspended' }); }}
              >
                Suspend account
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => { void patch({ status: 'active' }); }}
              >
                Reactivate account
              </Button>
            )}

            {user.mfaEnabled && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => { void patch({ mfaEnabled: false }); }}
              >
                Reset MFA (admin recovery)
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Linked identities</CardTitle></CardHeader>
          <CardContent>
            {user.identities.length === 0
              ? <p className="text-sm text-muted-foreground">No linked identities.</p>
              : (
                <ul className="space-y-1">
                  {user.identities.map((i) => (
                    <li key={i.providerId} className="text-sm">{i.providerId}: {i.email}</li>
                  ))}
                </ul>
              )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Roles</CardTitle></CardHeader>
          <CardContent>
            {user.roles.length === 0
              ? <p className="text-sm text-muted-foreground">No roles assigned.</p>
              : (
                <ul className="space-y-1">
                  {user.roles.map((r) => (
                    <li key={r} className="text-sm">{r}</li>
                  ))}
                </ul>
              )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
