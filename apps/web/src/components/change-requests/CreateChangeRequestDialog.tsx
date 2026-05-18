'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';

interface Props {
  signalIds: string[];
  onClose: () => void;
}

const PRIORITY_OPTIONS = [
  {
    value: 'p0',
    label: 'P0 â€” Critical',
    badgeClass:
      'inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive',
  },
  {
    value: 'p1',
    label: 'P1 â€” High',
    badgeClass:
      'inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
  {
    value: 'p2',
    label: 'P2 â€” Medium',
    badgeClass:
      'inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
  {
    value: 'p3',
    label: 'P3 â€” Low',
    badgeClass:
      'inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground',
  },
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
      <div
        className="rounded-md border bg-card text-card-foreground p-4"
        style={{ width: '100%', maxWidth: 440, padding: 24 }}
      >
        <div
          className="mb-3 flex items-center justify-between border-b pb-3"
          style={{ marginBottom: 16 }}
        >
          <div className="text-sm font-semibold">Create Change Request</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 13 }}>
            Creating from {signalIds.length} signal{signalIds.length !== 1 ? 's' : ''}. The AI will
            summarise the signals into a description and suggest affected pipeline stages.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontSize: 12, fontWeight: 500 }}>Priority</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {PRIORITY_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  onClick={() => {
                    setPriority(opt.value);
                  }}
                  className={`inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground ${opt.badgeClass}`}
                  style={{
                    cursor: 'pointer',
                    padding: '4px 10px',
                    border:
                      priority === opt.value
                        ? '2px solid var(--foreground)'
                        : '2px solid transparent',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 500,
                  }}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          <div
            style={{
              borderRadius: 4,
              padding: 12,
              fontSize: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <p style={{ fontWeight: 500 }}>What happens next</p>
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
                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  in change request
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <Button variant="outline" size="sm" type="button" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button size="sm" type="button" onClick={handleCreate} disabled={loading}>
            {loading ? 'Creatingâ€¦' : 'Create'}
          </Button>
        </div>
      </div>
    </div>
  );
}
