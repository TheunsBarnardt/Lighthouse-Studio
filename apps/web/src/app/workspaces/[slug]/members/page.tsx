'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

export default function WorkspaceMembersPage() {
  const { slug } = useParams<{ slug: string }>();
  const t = useTranslations('workspace.members');
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);

  const loadMembers = useCallback(() => {
    void fetch(`/api/v1/workspaces/${slug}/members`, { credentials: 'include' })
      .then((r) => r.json() as Promise<{ items: Member[] }>)
      .then((d) => { setMembers(d.items); return; })
      .catch(() => { /* error handled by empty state */ })
      .finally(() => { setLoading(false); });
  }, [slug]);

  useEffect(loadMembers, [loadMembers]);

  const filtered = members.filter(
    (m) =>
      !search ||
      (m.displayName?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      m.email.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      {/* Listens for member mutations via SSE and refreshes the list live */}
      <MemberEventListener workspaceId={slug} onEvent={() => { loadMembers(); }} />

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Button onClick={() => { setShowInvite(true); }}>{t('invite')}</Button>
      </div>

      <Tabs defaultValue="members">
        <TabsList className="mb-4">
          <TabsTrigger value="members">{t('membersTab')}</TabsTrigger>
          <TabsTrigger value="pending">{t('pendingTab')}</TabsTrigger>
        </TabsList>

        <TabsContent value="members">
          <Card>
            <CardHeader className="pb-3">
              <Input
                type="search"
                placeholder={t('searchPlaceholder')}
                value={search}
                onChange={(e) => { setSearch(e.target.value); }}
                aria-label={t('searchPlaceholder')}
              />
            </CardHeader>
            <CardContent>
              {loading && (
                <p className="py-8 text-center text-sm text-muted-foreground" aria-live="polite">
                  Loading…
                </p>
              )}
              {!loading && filtered.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">{t('noMembers')}</p>
              )}
              {!loading && filtered.length > 0 && (
                <table className="w-full text-sm" role="grid" aria-label={t('title')}>
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium">{t('columns.name')}</th>
                      <th className="pb-2 pr-4 font-medium">{t('columns.email')}</th>
                      <th className="pb-2 pr-4 font-medium">{t('columns.status')}</th>
                      <th className="pb-2 font-medium">{t('columns.joined')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((member) => (
                      <tr key={member.id} className="border-b last:border-0">
                        <td className="py-3 pr-4">
                          <Link href={`/workspaces/${slug}/members/${member.userId}`} className="font-medium hover:text-primary">
                            {member.displayName ?? member.email}
                          </Link>
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">{member.email}</td>
                        <td className="py-3 pr-4">
                          <Badge variant="secondary" className="text-xs">
                            {t(`status.${member.status}` as Parameters<typeof t>[0])}
                          </Badge>
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {new Date(member.joinedAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending">
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-sm text-muted-foreground">{t('noPending')}</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <InviteMemberDialog
        slug={slug}
        open={showInvite}
        onClose={() => { setShowInvite(false); }}
      />
    </div>
  );
}
