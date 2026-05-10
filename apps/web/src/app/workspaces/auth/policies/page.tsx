'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';

interface Policy {
  key: string;
  value: string;
  highlight?: 'success' | 'warning';
}

const POLICIES: Policy[] = [
  { key: 'Require MFA', value: 'Enabled Â· all roles', highlight: 'success' },
  { key: 'Password min length', value: '12 characters' },
  { key: 'Password complexity', value: 'Mixed case + number + symbol' },
  { key: 'Session lifetime', value: '8 hours' },
  { key: 'Idle timeout', value: '30 minutes' },
  { key: 'Max failed attempts', value: '5 Â· then account lock' },
  { key: 'Account lock duration', value: '15 minutes' },
  { key: 'SSO enforcement', value: 'Entra ID users must use SSO' },
];

export default function AuthPoliciesPage() {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(true);
    setEditing(false);
    setTimeout(() => {
      setSaved(false);
    }, 3000);
  }

  return (
    <div className="mx-auto max-w-[1440px] p-6" style={{ maxWidth: 800 }}>
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1>Auth Policies</h1>
          <p className="subtitle">Workspace-wide authentication requirements</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!editing ? (
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => {
                setEditing(true);
                setSaved(false);
              }}
            >
              Edit policies
            </Button>
          ) : (
            <>
              <Button size="sm" type="button" onClick={handleSave}>
                Save
              </Button>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => {
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      {saved && (
        <div
          style={{
            marginBottom: 16,
            padding: '10px 14px',
            borderRadius: '6px',
            background: 'var(--muted)',
            border: '1px solid var(--border)',
            fontSize: 13,
          }}
        >
          Auth policies saved successfully.
        </div>
      )}

      <div className="rounded-md border bg-card text-card-foreground p-4">
        <div className="mb-3 flex items-center justify-between border-b pb-3">
          <div className="text-sm font-semibold">Current policy</div>
        </div>
        {POLICIES.map((p, i) => (
          <div
            key={p.key}
            className="flex items-center justify-between border-b py-1.5 text-sm last:border-b-0"
            style={i < POLICIES.length - 1 ? {} : {}}
          >
            <span className="text-muted-foreground">{p.key}</span>
            <span
              className="font-medium"
              style={p.highlight === 'success' ? {} : p.highlight === 'warning' ? {} : {}}
            >
              {p.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
