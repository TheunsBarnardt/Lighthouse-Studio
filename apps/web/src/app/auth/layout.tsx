import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-canvas)',
        padding: '48px 16px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'center' }}>
          <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent-primary)' }}>
            Lighthouse Studio
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
