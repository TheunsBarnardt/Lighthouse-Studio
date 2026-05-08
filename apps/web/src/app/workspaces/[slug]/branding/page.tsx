'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const BrandingSchema = z.object({
  companyName: z.string().max(255).optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color like #3b82f6')
    .optional()
    .or(z.literal('')),
  emailFromName: z.string().max(255).optional(),
  customCss: z.string().optional(),
});

type BrandingValues = z.infer<typeof BrandingSchema>;

const inputStyle: React.CSSProperties = {
  height: 36,
  padding: '0 12px',
  borderRadius: 4,
  border: '1px solid var(--border-default)',
  background: 'var(--bg-canvas)',
  color: 'var(--fg-primary)',
  fontSize: 13,
  width: '100%',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--fg-primary)',
  display: 'block',
  marginBottom: 6,
};

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
      .catch(() => {
        /* ignore */
      })
      .finally(() => {
        setLoading(false);
      });
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

  if (loading)
    return (
      <p style={{ fontSize: 13, color: 'var(--fg-tertiary)' }} aria-live="polite">
        Loading…
      </p>
    );

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg-primary)', margin: 0 }}>
          Branding
        </h1>
      </div>

      <div className="pg-card">
        <div className="pg-card-header">
          <span className="pg-card-title">Workspace branding</span>
        </div>
        <div style={{ padding: 16 }}>
          <form
            onSubmit={(e) => {
              void form.handleSubmit(onSubmit)(e);
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            noValidate
          >
            <div>
              <label style={labelStyle}>Company name</label>
              <input style={inputStyle} placeholder="Acme Corp" {...form.register('companyName')} />
              {form.formState.errors.companyName && (
                <p
                  style={{ fontSize: 12, color: 'var(--fg-danger)', marginTop: 4, marginBottom: 0 }}
                >
                  {form.formState.errors.companyName.message}
                </p>
              )}
            </div>

            <div>
              <label style={labelStyle}>Primary colour</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="color"
                  style={{
                    height: 36,
                    width: 56,
                    padding: 2,
                    borderRadius: 4,
                    border: '1px solid var(--border-default)',
                    background: 'var(--bg-canvas)',
                    cursor: 'pointer',
                  }}
                  {...form.register('primaryColor')}
                />
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  placeholder="#3b82f6"
                  {...form.register('primaryColor')}
                />
              </div>
              {form.formState.errors.primaryColor && (
                <p
                  style={{ fontSize: 12, color: 'var(--fg-danger)', marginTop: 4, marginBottom: 0 }}
                >
                  {form.formState.errors.primaryColor.message}
                </p>
              )}
            </div>

            <div>
              <label style={labelStyle}>Email from name</label>
              <input
                style={inputStyle}
                placeholder="Acme Corp"
                {...form.register('emailFromName')}
              />
              {form.formState.errors.emailFromName && (
                <p
                  style={{ fontSize: 12, color: 'var(--fg-danger)', marginTop: 4, marginBottom: 0 }}
                >
                  {form.formState.errors.emailFromName.message}
                </p>
              )}
            </div>

            <div>
              <label style={labelStyle}>Custom CSS variables</label>
              <textarea
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 4,
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-canvas)',
                  color: 'var(--fg-primary)',
                  fontSize: 13,
                  fontFamily: 'var(--font-mono, monospace)',
                  minHeight: 120,
                  boxSizing: 'border-box',
                  resize: 'vertical',
                }}
                placeholder="--color-primary: #3b82f6;"
                {...form.register('customCss')}
              />
              <p
                style={{ fontSize: 12, color: 'var(--fg-tertiary)', marginTop: 4, marginBottom: 0 }}
              >
                Only CSS variable declarations are applied. Unsupported rules are stripped.
              </p>
            </div>

            {saved && (
              <div
                style={{
                  borderRadius: 6,
                  border: '1px solid var(--fg-success)',
                  background: 'color-mix(in srgb, var(--fg-success) 8%, var(--bg-canvas))',
                  padding: '10px 14px',
                  fontSize: 13,
                  color: 'var(--fg-success)',
                }}
              >
                Branding saved successfully.
              </div>
            )}
            {error && (
              <div
                style={{
                  borderRadius: 6,
                  border: '1px solid var(--fg-danger)',
                  background: 'color-mix(in srgb, var(--fg-danger) 8%, var(--bg-canvas))',
                  padding: '10px 14px',
                  fontSize: 13,
                  color: 'var(--fg-danger)',
                }}
              >
                {error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                className="pg-btn pg-btn-primary"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? 'Saving…' : 'Save branding'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
