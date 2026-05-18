'use client';

import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface A11yViolation {
  id: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical' | null;
  description: string;
  help: string;
  helpUrl: string;
  nodes: { target: string; html: string }[];
}

interface A11yReport {
  violations: A11yViolation[];
  passes: number;
  incomplete: number;
  ranAt: string;
}

interface A11yTabPanelProps {
  artifactId: string;
  reloadKey: number;
}

/**
 * Real axe-core a11y check.
 *
 * Runs axe-core (loaded via CDN at scan-time to keep the bundle small) inside
 * the preview iframe via postMessage. The iframe's selection-agent picks up a
 * `run-a11y` message, injects axe, runs `axe.run(document)`, and posts the
 * result back as `a11y-report`.
 *
 * v1 keeps the axe load CDN-only (no bundling). When we have a real artifact
 * generation pipeline the audit hook moves into the build step and runs
 * automatically per-component; this panel becomes a viewer.
 */
export function A11yTabPanel({ artifactId, reloadKey }: A11yTabPanelProps) {
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<A11yReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    setReport(null);
    setError(null);
  }, [artifactId, reloadKey]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; report?: A11yReport; error?: string };
      if (data.type === 'a11y-report' && data.report) {
        setReport(data.report);
        setRunning(false);
      } else if (data.type === 'a11y-error' && data.error) {
        setError(data.error);
        setRunning(false);
      }
    }
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
    };
  }, []);

  function run() {
    if (running) return;
    setRunning(true);
    setError(null);
    setReport(null);
    const win = iframeRef.current?.contentWindow;
    if (!win) {
      setError('Preview iframe not ready');
      setRunning(false);
      return;
    }
    win.postMessage({ source: 'lighthouse-a11y', type: 'run-a11y' }, window.location.origin);
  }

  const violationCount = report?.violations.length ?? 0;
  const criticalCount =
    report?.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious').length ?? 0;

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--card)',
      }}
    >
      <div
        style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          background: 'var(--muted)',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)' }}>
          Accessibility · axe-core
        </span>
        <button
          type="button"
          onClick={run}
          disabled={running}
          style={{
            padding: '4px 12px',
            fontSize: 11,
            border: 'none',
            borderRadius: 4,
            background: running ? 'var(--muted)' : 'var(--primary)',
            color: running ? 'var(--muted-foreground)' : 'var(--primary-foreground)',
            cursor: running ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontWeight: 500,
            fontFamily: 'inherit',
          }}
        >
          {running ? (
            <>
              <Loader2 style={{ width: 11, height: 11, animation: 'spin 1s linear infinite' }} />
              Scanning…
            </>
          ) : (
            <>
              <ShieldCheck style={{ width: 11, height: 11 }} />
              Run scan
            </>
          )}
        </button>
      </div>

      <iframe
        ref={iframeRef}
        src={`/preview/${encodeURIComponent(artifactId)}?a11y=1`}
        title="A11y scan target"
        sandbox="allow-scripts allow-same-origin"
        style={{ display: 'none' }}
        key={`${artifactId}-${String(reloadKey)}`}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {error && (
          <div
            style={{
              padding: 12,
              border: '1px solid var(--destructive)',
              borderRadius: 6,
              fontSize: 12,
              color: 'var(--destructive)',
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}

        {!report && !error && !running && (
          <div
            style={{
              padding: 40,
              textAlign: 'center',
              color: 'var(--muted-foreground)',
              fontSize: 12,
            }}
          >
            <ShieldCheck
              style={{
                width: 24,
                height: 24,
                margin: '0 auto 8px',
                color: 'var(--muted-foreground)',
              }}
            />
            Run an axe-core scan to surface WCAG violations in the current preview.
          </div>
        )}

        {report && (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 8,
                marginBottom: 16,
              }}
            >
              <Stat
                label="Violations"
                value={String(violationCount)}
                kind={violationCount > 0 ? 'bad' : 'good'}
              />
              <Stat
                label="Critical/Serious"
                value={String(criticalCount)}
                kind={criticalCount > 0 ? 'bad' : 'good'}
              />
              <Stat label="Passes" value={String(report.passes)} kind="good" />
            </div>

            {violationCount === 0 ? (
              <div
                style={{
                  padding: 16,
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: 'oklch(0.55 0.18 145)',
                }}
              >
                <CheckCircle2 style={{ width: 16, height: 16 }} />
                No violations found.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {report.violations.map((v) => (
                  <Violation key={v.id} v={v} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, kind }: { label: string; value: string; kind: 'good' | 'bad' }) {
  return (
    <div
      style={{
        padding: 10,
        border: '1px solid var(--border)',
        borderRadius: 6,
        background: 'var(--background)',
      }}
    >
      <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: kind === 'good' ? 'oklch(0.55 0.18 145)' : 'var(--destructive)',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Violation({ v }: { v: A11yViolation }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <AlertTriangle
          style={{
            width: 14,
            height: 14,
            color:
              v.impact === 'critical' || v.impact === 'serious'
                ? 'var(--destructive)'
                : 'oklch(0.65 0.18 65)',
            flexShrink: 0,
            marginTop: 2,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 2 }}>{v.help}</div>
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 6 }}>
            {v.description} ·{' '}
            <a
              href={v.helpUrl}
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--primary)' }}
            >
              docs
            </a>
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>
            Affects {v.nodes.length} element{v.nodes.length === 1 ? '' : 's'} ·{' '}
            <span
              style={{
                padding: '0 6px',
                borderRadius: 999,
                background: 'var(--muted)',
              }}
            >
              {v.impact ?? 'unknown'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
