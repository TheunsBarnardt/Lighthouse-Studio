'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

const BrandingSchema = z.object({
  companyName: z.string().max(255).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color like #3b82f6').optional().or(z.literal('')),
  emailFromName: z.string().max(255).optional(),
  customCss: z.string().optional(),
});

type BrandingValues = z.infer<typeof BrandingSchema>;

export default function WorkspaceBrandingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<BrandingValues>({
    resolver: zodResolver(BrandingSchema),
    defaultValues: { companyName: '', primaryColor: '', emailFromName: '', customCss: '' },
  });

  useEffect(() => {
    void fetch(`/api/v1/workspaces/${slug}/branding`, { credentials: 'include' })
      .then((r) => r.json() as Promise<BrandingValues & { logoFileId?: string }>)
      .then((d) => {
        form.reset({
          companyName: d.companyName ?? '',
          primaryColor: d.primaryColor ?? '',
          emailFromName: d.emailFromName ?? '',
          customCss: d.customCss ?? '',
        });
        return;
      })
      .catch(() => { /* ignore */ })
      .finally(() => { setLoading(false); });
  }, [slug, form]);

  async function onSubmit(values: BrandingValues) {
    setError(null);
    setSaved(false);
    const res = await fetch(`/api/v1/workspaces/${slug}/branding`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = (await res.json()) as { message?: string };
      setError(body.message ?? 'Failed to save branding.');
      return;
    }
    setSaved(true);
  }

  if (loading) return <p className="text-sm text-muted-foreground" aria-live="polite">Loading…</p>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Branding</h1>
      </div>

      <Card>
        <CardHeader><CardTitle>Workspace branding</CardTitle></CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={(e) => { void form.handleSubmit(onSubmit)(e); }} className="space-y-4" noValidate>
              <FormField control={form.control} name="companyName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Company name</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Corp" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="primaryColor" render={({ field }) => (
                <FormItem>
                  <FormLabel>Primary colour</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-3">
                      <Input type="color" className="h-10 w-16 cursor-pointer p-1" {...field} />
                      <Input placeholder="#3b82f6" className="flex-1" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="emailFromName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email from name</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Corp" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="customCss" render={({ field }) => (
                <FormItem>
                  <FormLabel>Custom CSS variables</FormLabel>
                  <FormControl>
                    <textarea
                      className="min-h-[120px] w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
                      placeholder="--color-primary: #3b82f6;"
                      {...field}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Only CSS variable declarations are applied. Unsupported rules are stripped.
                  </p>
                  <FormMessage />
                </FormItem>
              )} />

              {saved && (
                <Alert><AlertDescription>Branding saved successfully.</AlertDescription></Alert>
              )}
              {error && (
                <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
              )}

              <div className="flex justify-end">
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? 'Saving…' : 'Save branding'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
