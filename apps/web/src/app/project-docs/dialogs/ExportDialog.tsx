'use client';

import { Loader2, Download, CheckCircle2, X } from 'lucide-react';
import { useState } from 'react';

interface Props {
  onClose: () => void;
}

const inputStyle: React.CSSProperties = {
  height: 36,
  padding: '0 12px',
  borderRadius: 4,
  border: '1px solid var(--border-default)',
  background: 'var(--bg-canvas)',
  color: 'var(--fg-primary)',
  fontSize: 13,
  fontFamily: 'var(--font-mono, monospace)',
  width: '100%',
  boxSizing: 'border-box',
};

export function ExportDialog({ onClose }: Props) {
  const [step, setStep] = useState<'config' | 'generating' | 'ready'>('config');
  const [telemetryEnabled, setTelemetryEnabled] = useState(true);
  const [version, setVersion] = useState('v0.1.0');

  const handleExport = () => {
    setStep('generating');
    setTimeout(() => {
      setStep('ready');
    }, 3000);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)',
      }}
    >
      <div className="pg-card" style={{ width: 440, maxWidth: 'calc(100vw - 32px)' }}>
        <div
          className="pg-card-header"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <span className="pg-card-title">Export Documentation Site</span>
          <button className="pg-btn pg-btn-ghost pg-btn-xs" onClick={onClose}>
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>

        {step === 'config' && (
          <>
            <div
              style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              <p style={{ fontSize: 13, color: 'var(--fg-secondary)', margin: 0 }}>
                Generate a standalone Next.js + fumadocs documentation site. The export is a zip
                file that can be deployed to any static host.
              </p>

              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--fg-primary)',
                    display: 'block',
                    marginBottom: 6,
                  }}
                >
                  Version tag
                </label>
                <input
                  value={version}
                  onChange={(e) => {
                    setVersion(e.target.value);
                  }}
                  style={inputStyle}
                />
              </div>

              <label
                style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}
              >
                <input
                  type="checkbox"
                  checked={telemetryEnabled}
                  onChange={(e) => {
                    setTelemetryEnabled(e.target.checked);
                  }}
                  style={{ marginTop: 2 }}
                />
                <div>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: 'var(--fg-primary)',
                      margin: 0,
                      marginBottom: 2,
                    }}
                  >
                    Include telemetry
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--fg-tertiary)', margin: 0 }}>
                    The exported site will send anonymised page-view events back to this platform.
                    No PII is collected. You can disable this at any time by editing{' '}
                    <code className="pg-mono">lib/telemetry.ts</code>.
                  </p>
                </div>
              </label>

              <div
                style={{
                  borderRadius: 6,
                  background: 'var(--border-default)',
                  padding: 12,
                  fontSize: 12,
                  color: 'var(--fg-secondary)',
                }}
              >
                <p
                  style={{
                    fontWeight: 500,
                    color: 'var(--fg-primary)',
                    margin: 0,
                    marginBottom: 6,
                  }}
                >
                  What gets exported
                </p>
                <ul
                  style={{
                    listStyleType: 'disc',
                    paddingLeft: 16,
                    margin: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                  }}
                >
                  <li>All published documentation pages as MDX</li>
                  <li>Next.js + fumadocs project scaffold</li>
                  <li>Static search index</li>
                  {telemetryEnabled && (
                    <li>
                      Telemetry beacon (<code className="pg-mono">lib/telemetry.ts</code>)
                    </li>
                  )}
                  <li>Workspace brand assets (logo, colors)</li>
                </ul>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
                padding: 16,
                borderTop: '1px solid var(--border-default)',
              }}
            >
              <button className="pg-btn pg-btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button className="pg-btn pg-btn-primary" onClick={handleExport}>
                <Download style={{ width: 14, height: 14, marginRight: 6 }} />
                Export {version}
              </button>
            </div>
          </>
        )}

        {step === 'generating' && (
          <div
            style={{
              padding: 32,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <Loader2
              style={{
                width: 32,
                height: 32,
                color: 'var(--accent-primary)',
                animation: 'spin 1s linear infinite',
              }}
            />
            <div style={{ textAlign: 'center' }}>
              <p
                style={{ fontWeight: 500, color: 'var(--fg-primary)', margin: 0, marginBottom: 4 }}
              >
                Generating documentation site…
              </p>
              <p style={{ fontSize: 13, color: 'var(--fg-secondary)', margin: 0 }}>
                Building MDX pages, search index, and scaffold
              </p>
            </div>
          </div>
        )}

        {step === 'ready' && (
          <>
            <div
              style={{
                padding: '16px 16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <CheckCircle2 style={{ width: 40, height: 40, color: 'var(--fg-success)' }} />
              <div style={{ textAlign: 'center' }}>
                <p
                  style={{
                    fontWeight: 600,
                    color: 'var(--fg-primary)',
                    margin: 0,
                    marginBottom: 4,
                  }}
                >
                  Export ready
                </p>
                <p style={{ fontSize: 13, color: 'var(--fg-secondary)', margin: 0 }}>
                  <span className="pg-badge pg-badge-default pg-mono">{version}</span>
                  {' · '}~18 MB · fumadocs + Next.js
                </p>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
                padding: 16,
                borderTop: '1px solid var(--border-default)',
              }}
            >
              <button className="pg-btn pg-btn-secondary" onClick={onClose}>
                Close
              </button>
              <button className="pg-btn pg-btn-primary">
                <Download style={{ width: 14, height: 14, marginRight: 6 }} />
                Download ZIP
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
