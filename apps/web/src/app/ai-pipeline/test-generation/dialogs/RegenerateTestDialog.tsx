'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';

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
      <div
        className="rounded-md border bg-card text-card-foreground p-4"
        style={{ width: '100%', maxWidth: 440, padding: 24 }}
      >
        <div
          className="mb-3 flex items-center justify-between border-b pb-3"
          style={{ marginBottom: 16 }}
        >
          <div className="text-sm font-semibold">Regenerate Test</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label htmlFor="feedback" style={{ fontSize: 12, fontWeight: 500 }}>
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
                fontSize: 12,
                resize: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <p style={{ fontSize: 11 }}>
            Leave blank to regenerate with the same specification. Provide feedback to guide the
            changes.
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => {
              onClose();
            }}
            disabled={isRegenerating}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            type="button"
            onClick={() => {
              void handleRegenerate();
            }}
            disabled={isRegenerating}
          >
            {isRegenerating ? 'Regenerating…' : 'Regenerate'}
          </Button>
        </div>
      </div>
    </div>
  );
}
