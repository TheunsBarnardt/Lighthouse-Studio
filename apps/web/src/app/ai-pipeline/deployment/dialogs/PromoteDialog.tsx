'use client';

import { Button } from '@/components/ui/button';

interface Props {
  targetEnvironment: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function PromoteDialog({ targetEnvironment, onClose, onConfirm }: Props) {
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
          style={{ marginBottom: 12 }}
        >
          <div className="text-sm font-semibold">Promote to {targetEnvironment}</div>
        </div>
        <p style={{ fontSize: 13, marginBottom: 20 }}>
          This will initiate a deployment to <strong>{targetEnvironment}</strong>.
          {targetEnvironment === 'prod' &&
            ' Tests must pass and approvals from architect and workspace owner are required.'}
          {targetEnvironment === 'staging' && ' Tests will run before the deployment proceeds.'}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="outline" size="sm" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" type="button" onClick={onConfirm}>
            Promote to {targetEnvironment}
          </Button>
        </div>
      </div>
    </div>
  );
}
