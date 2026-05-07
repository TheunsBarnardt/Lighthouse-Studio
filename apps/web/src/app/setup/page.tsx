'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { notFound } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { Progress } from '@/components/ui/progress';

const SetupSchema = z.object({
  displayName: z.string().min(1, 'Name is required'),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  workspaceName: z.string().min(1, 'Workspace name is required'),
  workspaceSlug: z
    .string()
    .min(1, 'Workspace slug is required')
    .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers and hyphens'),
});

type SetupValues = z.infer<typeof SetupSchema>;

export default function SetupPage() {
  const t = useTranslations('setup');
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<SetupValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(SetupSchema as any),
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
      workspaceName: '',
      workspaceSlug: '',
    },
  });

  useEffect(() => {
    void fetch('/api/v1/setup/status', { credentials: 'include' })
      .then((r) => r.json() as Promise<{ initialized: boolean }>)
      .then((d) => {
        if (d.initialized) {
          notFound();
        }
        return;
      })
      .catch(() => {
        /* allow setup to proceed if status check fails */
      })
      .finally(() => {
        setChecking(false);
      });
  }, []);

  function slugify(value: string): string {
    return value
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  }

  async function onSubmit(values: SetupValues) {
    setError(null);
    const res = await fetch('/api/v1/setup', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = (await res.json()) as { message?: string };
      setError(body.message ?? 'Setup failed. Please try again.');
      return;
    }
    const data = (await res.json()) as { workspaceSlug?: string };
    router.replace(data.workspaceSlug ? `/workspaces/${data.workspaceSlug}` : '/');
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Progress value={undefined} className="w-48" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('ownerSectionTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={(e) => {
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
                      <FormLabel>{t('ownerNameLabel')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('ownerNamePlaceholder')}
                          autoComplete="name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('emailLabel')}</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder={t('emailPlaceholder')}
                          autoComplete="email"
                          aria-required
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('passwordLabel')}</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder={t('passwordPlaceholder')}
                          autoComplete="new-password"
                          aria-required
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="border-t pt-4">
                  <p className="mb-3 text-sm font-medium">{t('workspaceSectionTitle')}</p>

                  <FormField
                    control={form.control}
                    name="workspaceName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('workspaceNameLabel')}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t('workspaceNamePlaceholder')}
                            {...field}
                            onChange={(e) => {
                              field.onChange(e);
                              const current = form.getValues('workspaceSlug');
                              if (
                                !current ||
                                current === slugify(form.getValues('workspaceName'))
                              ) {
                                form.setValue('workspaceSlug', slugify(e.target.value));
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="workspaceSlug"
                    render={({ field }) => (
                      <FormItem className="mt-3">
                        <FormLabel>{t('workspaceSlugLabel')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('workspaceSlugPlaceholder')} {...field} />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">{t('workspaceSlugHint')}</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? t('submitting') : t('submit')}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
