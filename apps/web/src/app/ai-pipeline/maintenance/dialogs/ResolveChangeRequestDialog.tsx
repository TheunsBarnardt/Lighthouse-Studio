'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';

interface Props {
  requestId: string;
  onClose: () => void;
}

type Resolution = 'fixed' | 'wont_fix' | 'duplicate' | 'by_design';

const RESOLUTIONS: { value: Resolution; label: string; description: string }[] = [
  {
    value: 'fixed',
    label: 'Fixed',
    description: 'The issue has been resolved through a pipeline re-engagement.',
  },
  {
    value: 'wont_fix',
    label: "Won't Fix",
    description: 'The issue has been acknowledged but will not be addressed.',
  },
  {
    value: 'duplicate',
    label: 'Duplicate',
    description: 'This is a duplicate of another change request.',
  },
  { value: 'by_design', label: 'By Design', description: 'The reported behaviour is intentional.' },
];

export function ResolveChangeRequestDialog({ requestId: _requestId, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [resolution, setResolution] = useState<Resolution>('fixed');
  const [notes, setNotes] = useState('');

  const handleResolve = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onClose();
    }, 1200);
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
      <div
        className="rounded-md border bg-card text-card-foreground p-4"
        style={{ width: '100%', maxWidth: 440, padding: 24 }}
      >
        <div
          className="mb-3 flex items-center justify-between border-b pb-3"
          style={{ marginBottom: 16 }}
        >
          <div className="text-sm font-semibold">Resolve Change Request</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontSize: 12, fontWeight: 500 }}>Resolution</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {RESOLUTIONS.map((res) => (
                <label
                  key={res.value}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: 12,
                    borderRadius: 6,
                    border:
                      resolution === res.value
                        ? '1px solid var(--accent-primary)'
                        : '1px solid var(--border-default)',
                    background:
                      resolution === res.value
                        ? 'color-mix(in srgb, var(--accent-primary) 5%, transparent)'
                        : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="resolution"
                    value={res.value}
                    checked={resolution === res.value}
                    onChange={() => {
                      setResolution(res.value);
                    }}
                    style={{ marginTop: 2, cursor: 'pointer' }}
                  />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500 }}>{res.label}</p>
                    <p style={{ fontSize: 11, marginTop: 2 }}>{res.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 500 }}>Notes (optional)</label>
            <textarea
              style={{
                width: '100%',
                padding: '6px 8px',
                borderRadius: 4,
                border: '1px solid var(--border-default)',
                fontSize: 12,
                resize: 'none',
                boxSizing: 'border-box',
              }}
              rows={3}
              placeholder="Any additional context about this resolution…"
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <Button variant="outline" size="sm" type="button" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button size="sm" type="button" onClick={handleResolve} disabled={loading}>
            {loading ? 'Resolving…' : 'Resolve'}
          </Button>
        </div>
      </div>
    </div>
  );
}
