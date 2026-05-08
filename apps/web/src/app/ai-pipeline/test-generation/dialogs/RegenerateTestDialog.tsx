'use client';

import { useState } from 'react';

interface Props {
  testFileId: string;
  onClose: () => void;
}

export function RegenerateTestDialog({ testFileId: _testFileId, onClose: onCloseProp }: Props) {
  const onClose = () => {
    onCloseProp();
  };
  const [feedback, setFeedback] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    await new Promise((resolve) => setTimeout(resolve, 1800));
    setIsRegenerating(false);
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
          <div className="pg-card-title">Regenerate Test</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label
              htmlFor="feedback"
              style={{ fontSize: 12, fontWeight: 500, color: 'var(--fg-primary)' }}
            >
              Feedback (optional)
            </label>
            <textarea
              id="feedback"
              placeholder="e.g. Add a test for the case where email already exists. Use async/await instead of promise chains."
              value={feedback}
              onChange={(e) => {
                setFeedback(e.target.value);
              }}
              rows={4}
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
          <p style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}>
            Leave blank to regenerate with the same specification. Provide feedback to guide the
            changes.
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button
            className="pg-btn pg-btn-secondary pg-btn-sm"
            onClick={() => {
              onClose();
            }}
            disabled={isRegenerating}
          >
            Cancel
          </button>
          <button
            className="pg-btn pg-btn-primary pg-btn-sm"
            onClick={() => {
              void handleRegenerate();
            }}
            disabled={isRegenerating}
          >
            {isRegenerating ? 'Regenerating…' : 'Regenerate'}
          </button>
        </div>
      </div>
    </div>
  );
}
