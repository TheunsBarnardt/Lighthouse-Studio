'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

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

type TemplateKey = (typeof TEMPLATE_KEYS)[number]['key'];

interface TemplateOverride {
  subjectTemplate: string;
  htmlTemplate: string;
  textTemplate: string;
}

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

const textareaStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: 4,
  border: '1px solid var(--border-default)',
  background: 'var(--bg-canvas)',
  color: 'var(--fg-primary)',
  fontSize: 13,
  fontFamily: 'var(--font-mono, monospace)',
  boxSizing: 'border-box',
  resize: 'vertical',
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--fg-primary)',
  display: 'block',
  marginBottom: 6,
};

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
      .then((d) => {
        setOverrides(d.overrides as Partial<Record<TemplateKey, TemplateOverride>>);
        return;
      })
      .catch(() => {
        /* ignore */
      })
      .finally(() => {
        setLoading(false);
      });
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

  if (loading)
    return (
      <p style={{ fontSize: 13, color: 'var(--fg-tertiary)' }} aria-live="polite">
        Loading…
      </p>
    );

  const currentTemplate = TEMPLATE_KEYS.find((t) => t.key === selected);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: 'var(--fg-primary)',
            margin: 0,
            marginBottom: 4,
          }}
        >
          Email templates
        </h1>
        <p style={{ fontSize: 13, color: 'var(--fg-secondary)', margin: 0 }}>
          Override default email templates with custom subject and body for this workspace.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        {/* Template list sidebar */}
        <div
          style={{ width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          {TEMPLATE_KEYS.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setSelected(t.key);
                setMsg(null);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '7px 12px',
                borderRadius: 4,
                fontSize: 13,
                background:
                  selected === t.key
                    ? 'color-mix(in srgb, var(--accent-primary) 10%, var(--bg-canvas))'
                    : 'transparent',
                color: selected === t.key ? 'var(--accent-primary)' : 'var(--fg-primary)',
                border: `1px solid ${selected === t.key ? 'var(--accent-primary)' : 'transparent'}`,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {t.label}
              {overrides[t.key] && (
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--accent-primary)',
                    flexShrink: 0,
                  }}
                  aria-label="customised"
                />
              )}
            </button>
          ))}
        </div>

        {/* Template editor */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="pg-card">
            <div className="pg-card-header">
              <span className="pg-card-title">{currentTemplate?.label}</span>
              {!overrides[selected] && (
                <p style={{ fontSize: 12, color: 'var(--fg-tertiary)', margin: 0, marginTop: 2 }}>
                  Using platform default. Fill in below to override.
                </p>
              )}
            </div>
            <div style={{ padding: 16 }}>
              <form
                onSubmit={(e) => {
                  void handleSubmit(onSubmit)(e);
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
                noValidate
              >
                <div>
                  <label style={labelStyle} htmlFor={`subject-${selected}`}>
                    Subject
                  </label>
                  <input
                    id={`subject-${selected}`}
                    style={inputStyle}
                    placeholder="Default subject will be used if empty"
                    {...register('subjectTemplate')}
                  />
                </div>

                <div>
                  <label style={labelStyle} htmlFor={`html-${selected}`}>
                    HTML body
                  </label>
                  <textarea
                    id={`html-${selected}`}
                    style={{ ...textareaStyle, minHeight: 200 }}
                    placeholder="HTML template. Use {{variable}} for substitutions."
                    {...register('htmlTemplate')}
                  />
                </div>

                <div>
                  <label style={labelStyle} htmlFor={`text-${selected}`}>
                    Plain-text body (optional)
                  </label>
                  <textarea
                    id={`text-${selected}`}
                    style={{ ...textareaStyle, minHeight: 80 }}
                    placeholder="Plain-text fallback (derived from HTML if empty)"
                    {...register('textTemplate')}
                  />
                </div>

                {msg && (
                  <div
                    style={{
                      borderRadius: 6,
                      border: `1px solid ${msg.kind === 'error' ? 'var(--fg-danger)' : 'var(--fg-success)'}`,
                      background: `color-mix(in srgb, ${msg.kind === 'error' ? 'var(--fg-danger)' : 'var(--fg-success)'} 8%, var(--bg-canvas))`,
                      padding: '10px 14px',
                      fontSize: 13,
                      color: msg.kind === 'error' ? 'var(--fg-danger)' : 'var(--fg-success)',
                    }}
                  >
                    {msg.text}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="submit"
                    className="pg-btn pg-btn-primary"
                    disabled={saving || formState.isSubmitting}
                  >
                    {saving ? 'Saving…' : 'Save override'}
                  </button>
                  {overrides[selected] && (
                    <button
                      type="button"
                      className="pg-btn pg-btn-secondary"
                      disabled={saving}
                      onClick={() => {
                        void resetTemplate();
                      }}
                    >
                      Reset to default
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
