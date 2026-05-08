'use client';

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
      <div className="pg-card" style={{ width: '100%', maxWidth: 440, padding: 24 }}>
        <div className="pg-card-header" style={{ marginBottom: 12 }}>
          <div className="pg-card-title">Promote to {targetEnvironment}</div>
        </div>
        <p style={{ fontSize: 13, color: 'var(--fg-secondary)', marginBottom: 20 }}>
          This will initiate a deployment to{' '}
          <strong style={{ color: 'var(--fg-primary)' }}>{targetEnvironment}</strong>.
          {targetEnvironment === 'prod' &&
            ' Tests must pass and approvals from architect and workspace owner are required.'}
          {targetEnvironment === 'staging' && ' Tests will run before the deployment proceeds.'}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="pg-btn pg-btn-secondary pg-btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button className="pg-btn pg-btn-primary pg-btn-sm" onClick={onConfirm}>
            Promote to {targetEnvironment}
          </button>
        </div>
      </div>
    </div>
  );
}
