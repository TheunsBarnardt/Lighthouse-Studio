'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/auth-context';

const ProfileSchema = z.object({
  displayName: z.string().min(1, 'Display name is required').max(255),
});

export default function ProfilePage() {
  const t = useTranslations('account.profile');
  const { user, refresh } = useAuth();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(ProfileSchema as any),
    defaultValues: { displayName: user?.displayName ?? '' },
  });

  useEffect(() => {
    if (user) {
      form.reset({ displayName: user.displayName ?? '' });
    }
  }, [user, form]);

  async function onSubmit(values: { displayName: string }) {
    setError(null);
    setSaved(false);
    try {
      await fetch('/api/v1/me/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      await refresh();
      setSaved(true);
    } catch {
      setError('Failed to save profile.');
    }
  }

  function initials(name: string | null, email: string) {
    const n = name ?? email;
    return n.slice(0, 2).toUpperCase();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-6 flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={user?.avatarUrl ?? undefined} alt={user?.displayName ?? 'Avatar'} />
            <AvatarFallback>
              {initials(user?.displayName ?? null, user?.email ?? '')}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              aria-label={t('uploadAvatar')}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  // TODO: crop then upload via /api/v1/me/avatar
                  void file;
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                fileInputRef.current?.click();
              }}
            >
              {t('uploadAvatar')}
            </Button>
          </div>
        </div>

        <Form {...form}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void form.handleSubmit(onSubmit)(e);
            }}
            className="space-y-4"
            noValidate
          >
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('displayNameLabel')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('displayNamePlaceholder')} aria-required {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div>
              <p className="mb-1 text-sm font-medium">{t('emailLabel')}</p>
              <p className="text-sm text-muted-foreground">{user?.email ?? '—'}</p>
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {saved && (
              <Alert>
                <AlertDescription>{t('saved')}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? t('saving') : t('save')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
