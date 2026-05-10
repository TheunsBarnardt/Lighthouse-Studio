'use client';

import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

interface Props {
  deploymentId: string;
  onClose: () => void;
}

export function RollbackDialog({ deploymentId: _deploymentId, onClose }: Props) {
  const [reason, setReason] = useState('');
  const [isRollingBack, setIsRollingBack] = useState(false);

  const handleRollback = async () => {
    setIsRollingBack(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsRollingBack(false);
    onClose();
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
          <div className="text-sm font-semibold">Rollback Deployment</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              padding: 12,
              borderRadius: 6,
              border: '1px solid oklch(0.45 0.14 75)',
              background: 'color-mix(in srgb, oklch(0.45 0.14 75) 8%, transparent)',
            }}
          >
            <AlertTriangle
              style={{
                width: 16,
                height: 16,
                marginTop: 2,
                flexShrink: 0,
              }}
            />
            <div style={{ fontSize: 13 }}>
              <p style={{ fontWeight: 500, marginBottom: 4 }}>Rollback will revert</p>
              <ul
                style={{
                  fontSize: 11,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  listStyle: 'none',
                  padding: 0,
                }}
              >
                <li>â€¢ UI bundle to previous version</li>
                <li>â€¢ Server functions to previous version</li>
                <li>â€¢ Schema migrations (if reversible)</li>
              </ul>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label htmlFor="reason" style={{ fontSize: 12, fontWeight: 500 }}>
              Reason (optional)
            </label>
            <textarea
              id="reason"
              placeholder="e.g. Health check failing after deploy. Users seeing 500 errors on checkout."
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
              }}
              rows={3}
              style={{
                width: '100%',
                padding: '6px 8px',
                borderRadius: 4,
                border: '1px solid var(--border)',
                fontSize: 12,
                resize: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={onClose}
            disabled={isRollingBack}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            type="button"
            onClick={() => {
              void handleRollback();
            }}
            disabled={isRollingBack}
            style={{ background: 'var(--destructive)', borderColor: 'var(--destructive)' }}
          >
            {isRollingBack ? 'Rolling backâ€¦' : 'Initiate Rollback'}
          </Button>
        </div>
      </div>
    </div>
  );
}
