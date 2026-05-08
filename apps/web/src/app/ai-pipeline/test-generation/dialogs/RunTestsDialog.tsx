'use client';

import { useState } from 'react';

type TestType = 'unit' | 'component' | 'integration' | 'e2e';

interface Props {
  onClose: () => void;
  onStarted: () => void;
}

const TEST_TYPES: { value: TestType; label: string; description: string }[] = [
  { value: 'unit', label: 'Unit Tests', description: 'Fast, isolated business logic tests' },
  {
    value: 'component',
    label: 'Component Tests',
    description: 'React component render and interaction tests',
  },
  {
    value: 'integration',
    label: 'Integration Tests',
    description: 'API and database tests (requires test DB)',
  },
  { value: 'e2e', label: 'E2E Tests', description: 'Full user journey tests via Playwright' },
];

export function RunTestsDialog({ onClose: onCloseProp, onStarted: onStartedProp }: Props) {
  const onClose = () => {
    onCloseProp();
  };
  const onStarted = () => {
    onStartedProp();
  };
  const [selected, setSelected] = useState<Set<TestType>>(new Set(['unit', 'component']));
  const [deploymentUrl, setDeploymentUrl] = useState('');

  const toggle = (type: TestType) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const needsUrl = selected.has('e2e');

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
    >
      <div className="pg-card" style={{ width: '100%', maxWidth: 440, padding: 24 }}>
        <div className="pg-card-header" style={{ marginBottom: 16 }}>
          <div className="pg-card-title">Run Tests</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 13, color: 'var(--fg-secondary)' }}>
            Select which test types to run.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {TEST_TYPES.map((t) => (
              <div
                key={t.value}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: 12,
                  borderRadius: 6,
                  border: '1px solid var(--border-default)',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  toggle(t.value);
                }}
              >
                <input
                  type="checkbox"
                  id={t.value}
                  checked={selected.has(t.value)}
                  onChange={() => {
                    toggle(t.value);
                  }}
                  style={{ marginTop: 2, cursor: 'pointer' }}
                />
                <div>
                  <label
                    htmlFor={t.value}
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: 'var(--fg-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    {t.label}
                  </label>
                  <p style={{ fontSize: 11, color: 'var(--fg-tertiary)', marginTop: 2 }}>
                    {t.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {needsUrl && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label
                htmlFor="deploymentUrl"
                style={{ fontSize: 12, fontWeight: 500, color: 'var(--fg-primary)' }}
              >
                Deployment URL (required for E2E)
              </label>
              <input
                id="deploymentUrl"
                placeholder="https://my-app.preview.platform.dev"
                value={deploymentUrl}
                onChange={(e) => {
                  setDeploymentUrl(e.target.value);
                }}
                style={{
                  height: 28,
                  padding: '0 8px',
                  borderRadius: 4,
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-canvas)',
                  color: 'var(--fg-primary)',
                  fontSize: 12,
                }}
              />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button
            className="pg-btn pg-btn-secondary pg-btn-sm"
            onClick={() => {
              onClose();
            }}
          >
            Cancel
          </button>
          <button
            className="pg-btn pg-btn-primary pg-btn-sm"
            onClick={() => {
              onStarted();
            }}
            disabled={selected.size === 0 || (needsUrl && !deploymentUrl)}
          >
            Start Test Run
          </button>
        </div>
      </div>
    </div>
  );
}
