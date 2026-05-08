'use client';

import { useState } from 'react';

interface Policy {
  key: string;
  value: string;
  highlight?: 'success' | 'warning';
}

const POLICIES: Policy[] = [
  { key: 'Require MFA', value: 'Enabled · all roles', highlight: 'success' },
  { key: 'Password min length', value: '12 characters' },
  { key: 'Password complexity', value: 'Mixed case + number + symbol' },
  { key: 'Session lifetime', value: '8 hours' },
  { key: 'Idle timeout', value: '30 minutes' },
  { key: 'Max failed attempts', value: '5 · then account lock' },
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
    <div className="pg-page" style={{ maxWidth: 800 }}>
      {/* Header */}
      <div className="pg-page-header">
        <div>
          <h1>Auth Policies</h1>
          <p className="subtitle">Workspace-wide authentication requirements</p>
        </div>
        <div className="pg-page-header-actions">
          {!editing ? (
            <button
              className="pg-btn pg-btn-secondary pg-btn-sm"
              onClick={() => {
                setEditing(true);
                setSaved(false);
              }}
            >
              Edit policies
            </button>
          ) : (
            <>
              <button className="pg-btn pg-btn-primary pg-btn-sm" onClick={handleSave}>
                Save
              </button>
              <button
                className="pg-btn pg-btn-ghost pg-btn-sm"
                onClick={() => {
                  setEditing(false);
                }}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {saved && (
        <div
          style={{
            marginBottom: 16,
            padding: '10px 14px',
            borderRadius: 'var(--shell-radius-md)',
            background: 'var(--bg-surface-2)',
            border: '1px solid var(--border-default)',
            fontSize: 13,
            color: 'var(--fg-success)',
          }}
        >
          Auth policies saved successfully.
        </div>
      )}

      <div className="pg-card">
        <div className="pg-card-header">
          <div className="pg-card-title">Current policy</div>
        </div>
        {POLICIES.map((p, i) => (
          <div
            key={p.key}
            className="pg-inspector-row"
            style={
              i < POLICIES.length - 1 ? { borderBottom: '1px solid var(--border-default)' } : {}
            }
          >
            <span className="pg-inspector-key">{p.key}</span>
            <span
              className="pg-inspector-val"
              style={
                p.highlight === 'success'
                  ? { color: 'var(--fg-success)' }
                  : p.highlight === 'warning'
                    ? { color: 'var(--fg-warning)' }
                    : {}
              }
            >
              {p.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
