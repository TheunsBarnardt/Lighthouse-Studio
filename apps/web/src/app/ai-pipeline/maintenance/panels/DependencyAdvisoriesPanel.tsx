'use client';

import { ShieldAlert } from 'lucide-react';

interface Advisory {
  id: string;
  packageName: string;
  installedVersion: string;
  fixedVersion: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  cveId?: string;
  description: string;
  recommendedAction: 'upgrade_now' | 'upgrade_soon' | 'monitor';
}

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'pg-badge-danger',
  high: 'pg-badge-danger',
  medium: 'pg-badge-warning',
  low: 'pg-badge-default',
};

const ACTION_LABEL: Record<string, string> = {
  upgrade_now: 'Upgrade now',
  upgrade_soon: 'Upgrade soon',
  monitor: 'Monitor',
};

const ACTION_BADGE: Record<string, string> = {
  upgrade_now: 'pg-badge-danger',
  upgrade_soon: 'pg-badge-warning',
  monitor: 'pg-badge-default',
};

const DEMO_ADVISORIES: Advisory[] = [
  {
    id: 'adv-1',
    packageName: 'fast-xml-parser',
    installedVersion: '4.2.4',
    fixedVersion: '4.3.0',
    severity: 'high',
    cveId: 'CVE-2023-34104',
    description: 'XSS vulnerability when parsing malicious XML input. Fix available in v4.3.0.',
    recommendedAction: 'upgrade_now',
  },
];

export function DependencyAdvisoriesPanel() {
  if (DEMO_ADVISORIES.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: 192,
          color: 'var(--fg-tertiary)',
          gap: 8,
        }}
      >
        <ShieldAlert style={{ width: 32, height: 32 }} />
        <p style={{ fontSize: 13 }}>No active advisories</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg-primary)' }}>
        Dependency Advisories ({DEMO_ADVISORIES.length})
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {DEMO_ADVISORIES.map((adv) => (
          <div
            key={adv.id}
            style={{
              border: '1px solid var(--border-default)',
              borderRadius: 6,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <ShieldAlert
                style={{
                  width: 18,
                  height: 18,
                  color: 'var(--fg-warning)',
                  marginTop: 2,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flexWrap: 'wrap',
                    marginBottom: 4,
                  }}
                >
                  <span
                    className="pg-mono"
                    style={{ fontWeight: 500, fontSize: 13, color: 'var(--fg-primary)' }}
                  >
                    {adv.packageName}
                  </span>
                  <span className={`pg-badge ${SEVERITY_BADGE[adv.severity]}`}>{adv.severity}</span>
                  {adv.cveId && (
                    <span className="pg-badge pg-badge-default pg-mono">{adv.cveId}</span>
                  )}
                </div>
                <p style={{ fontSize: 12, color: 'var(--fg-secondary)', marginBottom: 4 }}>
                  Installed:{' '}
                  <span className="pg-mono" style={{ color: 'var(--fg-primary)' }}>
                    {adv.installedVersion}
                  </span>
                  {' → '}
                  Fix:{' '}
                  <span className="pg-mono" style={{ color: 'var(--fg-success)' }}>
                    {adv.fixedVersion}
                  </span>
                </p>
                <p style={{ fontSize: 13, color: 'var(--fg-primary)' }}>{adv.description}</p>
              </div>
            </div>

            <div
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}
            >
              <span className={`pg-badge ${ACTION_BADGE[adv.recommendedAction]}`}>
                {ACTION_LABEL[adv.recommendedAction]}
              </span>
              <button className="pg-btn pg-btn-primary pg-btn-sm">Create Change Request</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
