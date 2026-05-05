'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const TEMPLATE_KEYS = [
  { key: 'email_verification', label: 'Email verification' },
  { key: 'welcome', label: 'Welcome' },
  { key: 'password_reset', label: 'Password reset' },
  { key: 'magic_link', label: 'Magic link' },
  { key: 'workspace_invitation', label: 'Workspace invitation' },
  { key: 'mfa_enabled', label: 'MFA enabled' },
  { key: 'mfa_disabled', label: 'MFA disabled' },
  { key: 'email_changed', label: 'Email changed' },
  { key: 'password_changed', label: 'Password changed' },
  { key: 'new_device_sign_in', label: 'New device sign-in' },
  { key: 'account_deletion', label: 'Account deletion' },
] as const;

type TemplateKey = typeof TEMPLATE_KEYS[number]['key'];

interface TemplateOverride {
  subjectTemplate: string;
  htmlTemplate: string;
  textTemplate: string;
}

export default function WorkspaceEmailTemplatesPage() {
  const { slug } = useParams<{ slug: string }>();
  const [selected, setSelected] = useState<TemplateKey>('email_verification');
  const [overrides, setOverrides] = useState<Partial<Record<TemplateKey, TemplateOverride>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const { register, handleSubmit, reset, formState } = useForm<TemplateOverride>({
    defaultValues: { subjectTemplate: '', htmlTemplate: '', textTemplate: '' },
  });

  useEffect(() => {
    void fetch(`/api/v1/workspaces/${slug}/email-templates`, { credentials: 'include' })
      .then((r) => r.json() as Promise<{ overrides: Record<string, TemplateOverride> }>)
      .then((d) => { setOverrides(d.overrides as Partial<Record<TemplateKey, TemplateOverride>>); return; })
      .catch(() => { /* ignore */ })
      .finally(() => { setLoading(false); });
  }, [slug]);

  useEffect(() => {
    const o = overrides[selected];
    reset(o ?? { subjectTemplate: '', htmlTemplate: '', textTemplate: '' });
  }, [selected, overrides, reset]);

  async function onSubmit(values: TemplateOverride) {
    setMsg(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/workspaces/${slug}/email-templates/${selected}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        setMsg({ kind: 'error', text: body.message ?? 'Save failed.' });
        return;
      }
      setOverrides((prev) => ({ ...prev, [selected]: values }));
      setMsg({ kind: 'success', text: 'Template override saved.' });
    } finally {
      setSaving(false);
    }
  }

  async function resetTemplate() {
    setMsg(null);
    setSaving(true);
    try {
      await fetch(`/api/v1/workspaces/${slug}/email-templates/${selected}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      setOverrides((prev) => {
        const { [selected]: _removed, ...rest } = prev;
        return rest as Partial<Record<TemplateKey, TemplateOverride>>;
      });
      reset({ subjectTemplate: '', htmlTemplate: '', textTemplate: '' });
      setMsg({ kind: 'success', text: 'Reset to platform default.' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground" aria-live="polite">Loading…</p>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Email templates</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Override default email templates with custom subject and body for this workspace.
        </p>
      </div>

      <Tabs value={selected} onValueChange={(v) => { setSelected(v as TemplateKey); }}>
        <TabsList className="mb-4 flex-wrap">
          {TEMPLATE_KEYS.map((t) => (
            <TabsTrigger key={t.key} value={t.key} className="relative">
              {t.label}
              {overrides[t.key] && (
                <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-primary" aria-label="customised" />
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {TEMPLATE_KEYS.map((t) => (
          <TabsContent key={t.key} value={t.key}>
            <Card>
              <CardHeader>
                <CardTitle>{t.label}</CardTitle>
                {!overrides[t.key] && (
                  <p className="text-xs text-muted-foreground">Using platform default. Fill in below to override.</p>
                )}
              </CardHeader>
              <CardContent>
                <form onSubmit={(e) => { void handleSubmit(onSubmit)(e); }} className="space-y-4" noValidate>
                  <div>
                    <label className="mb-1 block text-sm font-medium" htmlFor={`subject-${t.key}`}>
                      Subject
                    </label>
                    <input
                      id={`subject-${t.key}`}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      placeholder="Default subject will be used if empty"
                      {...register('subjectTemplate')}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium" htmlFor={`html-${t.key}`}>
                      HTML body
                    </label>
                    <textarea
                      id={`html-${t.key}`}
                      className="min-h-[200px] w-full rounded-md border bg-background px-3 py-2 font-mono text-sm"
                      placeholder="HTML template. Use {{variable}} for substitutions."
                      {...register('htmlTemplate')}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium" htmlFor={`text-${t.key}`}>
                      Plain-text body (optional)
                    </label>
                    <textarea
                      id={`text-${t.key}`}
                      className="min-h-[80px] w-full rounded-md border bg-background px-3 py-2 font-mono text-sm"
                      placeholder="Plain-text fallback (derived from HTML if empty)"
                      {...register('textTemplate')}
                    />
                  </div>

                  {msg && (
                    <Alert variant={msg.kind === 'error' ? 'destructive' : 'default'}>
                      <AlertDescription>{msg.text}</AlertDescription>
                    </Alert>
                  )}

                  <div className="flex gap-2">
                    <Button type="submit" disabled={saving || formState.isSubmitting}>
                      {saving ? 'Saving…' : 'Save override'}
                    </Button>
                    {overrides[t.key] && (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={saving}
                        onClick={() => { void resetTemplate(); }}
                      >
                        Reset to default
                      </Button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
