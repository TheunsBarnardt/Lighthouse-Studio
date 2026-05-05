'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/context/auth-context';

export default function DangerZonePage() {
  const t = useTranslations('account.dangerZone');
  const { user } = useAuth();
  const [deleteEmail, setDeleteEmail] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const canDelete = deleteEmail === user?.email;

  async function handleDelete() {
    if (!canDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch('/api/v1/me', {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        setDeleteError(body.message ?? 'Failed.');
        return;
      }
      window.location.href = '/auth/sign-in';
    } catch {
      setDeleteError('Failed to delete account.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card className="border-destructive/30">
      <CardHeader><CardTitle className="text-destructive">{t('title')}</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        {/* Data export */}
        <div>
          <h3 className="mb-1 text-sm font-semibold">{t('exportData')}</h3>
          <p className="mb-3 text-sm text-muted-foreground">{t('exportDataDescription')}</p>
          <Button variant="outline" onClick={() => { /* TODO: request data export */ }}>
            {t('export')}
          </Button>
        </div>

        <Separator />

        {/* Delete account */}
        <div>
          <h3 className="mb-1 text-sm font-semibold text-destructive">{t('deleteAccount')}</h3>
          <p className="mb-3 text-sm text-muted-foreground">{t('deleteAccountDescription')}</p>
          <Alert className="mb-3">
            <AlertDescription>{t('gracePeriod')}</AlertDescription>
          </Alert>
          <div className="space-y-2">
            <Label htmlFor="delete-confirm">{t('deleteConfirmMessage')}</Label>
            <Input
              id="delete-confirm"
              type="email"
              placeholder={t('deleteConfirmPlaceholder')}
              value={deleteEmail}
              onChange={(e) => { setDeleteEmail(e.target.value); }}
              aria-required
            />
          </div>
          {deleteError && (
            <Alert variant="destructive" className="mt-2">
              <AlertDescription>{deleteError}</AlertDescription>
            </Alert>
          )}
          <Button
            variant="destructive"
            className="mt-4"
            disabled={!canDelete || deleting}
            onClick={() => { void handleDelete(); }}
          >
            {deleting ? 'Deleting…' : t('deleteConfirm')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
