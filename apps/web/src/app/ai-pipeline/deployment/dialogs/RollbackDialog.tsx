'use client';

import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';

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
      <div className="pg-card" style={{ width: '100%', maxWidth: 440, padding: 24 }}>
        <div className="pg-card-header" style={{ marginBottom: 16 }}>
          <div className="pg-card-title">Rollback Deployment</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              padding: 12,
              borderRadius: 6,
              border: '1px solid var(--fg-warning)',
              background: 'color-mix(in srgb, var(--fg-warning) 8%, transparent)',
            }}
          >
            <AlertTriangle
              style={{
                width: 16,
                height: 16,
                color: 'var(--fg-warning)',
                marginTop: 2,
                flexShrink: 0,
              }}
            />
            <div style={{ fontSize: 13, color: 'var(--fg-primary)' }}>
              <p style={{ fontWeight: 500, marginBottom: 4 }}>Rollback will revert</p>
              <ul
                style={{
                  fontSize: 11,
                  color: 'var(--fg-secondary)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  listStyle: 'none',
                  padding: 0,
                }}
              >
                <li>• UI bundle to previous version</li>
                <li>• Server functions to previous version</li>
                <li>• Schema migrations (if reversible)</li>
              </ul>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label
              htmlFor="reason"
              style={{ fontSize: 12, fontWeight: 500, color: 'var(--fg-primary)' }}
            >
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
                border: '1px solid var(--border-default)',
                background: 'var(--bg-canvas)',
                color: 'var(--fg-primary)',
                fontSize: 12,
                resize: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button
            className="pg-btn pg-btn-secondary pg-btn-sm"
            onClick={onClose}
            disabled={isRollingBack}
          >
            Cancel
          </button>
          <button
            className="pg-btn pg-btn-primary pg-btn-sm"
            onClick={() => {
              void handleRollback();
            }}
            disabled={isRollingBack}
            style={{ background: 'var(--fg-danger)', borderColor: 'var(--fg-danger)' }}
          >
            {isRollingBack ? 'Rolling back…' : 'Initiate Rollback'}
          </button>
        </div>
      </div>
    </div>
  );
}
