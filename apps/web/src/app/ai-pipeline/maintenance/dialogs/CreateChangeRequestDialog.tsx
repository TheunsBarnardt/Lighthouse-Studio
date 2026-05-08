'use client';

import { useState } from 'react';

interface Props {
  signalIds: string[];
  onClose: () => void;
}

const PRIORITY_OPTIONS = [
  { value: 'p0', label: 'P0 — Critical', badgeClass: 'pg-badge-danger' },
  { value: 'p1', label: 'P1 — High', badgeClass: 'pg-badge-warning' },
  { value: 'p2', label: 'P2 — Medium', badgeClass: 'pg-badge-warning' },
  { value: 'p3', label: 'P3 — Low', badgeClass: 'pg-badge-default' },
];

export function CreateChangeRequestDialog({ signalIds, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [priority, setPriority] = useState('p1');

  const handleCreate = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onClose();
    }, 1500);
  };

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
          <div className="pg-card-title">Create Change Request</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 13, color: 'var(--fg-secondary)' }}>
            Creating from {signalIds.length} signal{signalIds.length !== 1 ? 's' : ''}. The AI will
            summarise the signals into a description and suggest affected pipeline stages.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--fg-primary)' }}>Priority</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setPriority(opt.value);
                  }}
                  className={`pg-badge ${opt.badgeClass}`}
                  style={{
                    cursor: 'pointer',
                    padding: '4px 10px',
                    border:
                      priority === opt.value
                        ? '2px solid var(--fg-primary)'
                        : '2px solid transparent',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 500,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div
            style={{
              borderRadius: 4,
              background: 'var(--bg-surface)',
              padding: 12,
              fontSize: 12,
              color: 'var(--fg-secondary)',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <p style={{ fontWeight: 500, color: 'var(--fg-primary)' }}>What happens next</p>
            <ul
              style={{
                listStyle: 'disc',
                paddingLeft: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <li>AI generates a description from the selected signals</li>
              <li>Affected pipeline stages are identified automatically</li>
              <li>
                Signals are linked and marked{' '}
                <span className="pg-badge pg-badge-default">in change request</span>
              </li>
            </ul>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button
            className="pg-btn pg-btn-secondary pg-btn-sm"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="pg-btn pg-btn-primary pg-btn-sm"
            onClick={handleCreate}
            disabled={loading}
          >
            {loading ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
