'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

const InviteSchema = z.object({
  email: z.string().email('Enter a valid email address'),
});

interface Props {
  slug: string;
  open: boolean;
  onClose: () => void;
}

export function InviteMemberDialog({ slug, open, onClose }: Props) {
  const t = useTranslations('workspace.invite');
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const form = useForm({ resolver: zodResolver(InviteSchema), defaultValues: { email: '' } });

  async function onSubmit(values: { email: string }) {
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/v1/workspaces/${slug}/members`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: values.email, roleIds: ['member'] }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        setError(body.message ?? t('error'));
        return;
      }
      setSuccess(t('success', { email: values.email }));
      form.reset();
    } catch {
      setError(t('error'));
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal
      aria-label={t('title')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    >
      <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold">{t('title')}</h2>
        <Form {...form}>
          <form onSubmit={(e) => { void form.handleSubmit(onSubmit)(e); }} className="space-y-4" noValidate>
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('emailLabel')}</FormLabel>
                <FormControl>
                  <Input type="email" placeholder={t('emailPlaceholder')} aria-required {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            {success && <Alert><AlertDescription>{success}</AlertDescription></Alert>}
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? t('submitting') : t('submit')}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
