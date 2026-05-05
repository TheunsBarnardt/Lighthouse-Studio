'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface AdminUser {
  id: string;
  email: string;
  displayName: string | null;
  status: string;
  mfaEnabled: boolean;
  createdAt: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ q: search, page: '1', limit: '20' });
    void (async () => {
      try {
        const r = await fetch(`/api/v1/admin/users?${params.toString()}`, { credentials: 'include' });
        const d = (await r.json()) as { items: AdminUser[]; total: number };
        setUsers(d.items);
        setTotal(d.total);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [search]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">All users</h1>
        <span className="text-sm text-muted-foreground">{total} total</span>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <Input
            type="search"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); }}
            aria-label="Search users"
          />
        </CardHeader>
        <CardContent>
          {loading && (
            <p className="py-8 text-center text-sm text-muted-foreground" aria-live="polite">Loading…</p>
          )}
          {!loading && users.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No users found.</p>
          )}
          {!loading && users.length > 0 && (
            <table className="w-full text-sm" role="grid" aria-label="All users">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Name</th>
                  <th className="pb-2 pr-4 font-medium">Email</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">MFA</th>
                  <th className="pb-2 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b last:border-0">
                    <td className="py-3 pr-4">
                      <Link href={`/admin/users/${user.id}`} className="font-medium hover:text-primary">
                        {user.displayName ?? user.email}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">{user.email}</td>
                    <td className="py-3 pr-4">
                      <Badge variant="secondary" className="text-xs">{user.status}</Badge>
                    </td>
                    <td className="py-3 pr-4">
                      {user.mfaEnabled
                        ? <Badge variant="secondary" className="text-xs">Enabled</Badge>
                        : <span className="text-xs text-muted-foreground">Off</span>}
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
