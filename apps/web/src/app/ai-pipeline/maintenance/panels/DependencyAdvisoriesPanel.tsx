'use client';

import { ShieldAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';

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
  critical:
    'inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive',
  high: 'inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive',
  medium:
    'inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  low: 'inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground',
};

const ACTION_LABEL: Record<string, string> = {
  upgrade_now: 'Upgrade now',
  upgrade_soon: 'Upgrade soon',
  monitor: 'Monitor',
};

const ACTION_BADGE: Record<string, string> = {
  upgrade_now:
    'inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive',
  upgrade_soon:
    'inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  monitor:
    'inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground',
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
      <h2 style={{ fontWeight: 600, fontSize: 14 }}>
        Dependency Advisories ({DEMO_ADVISORIES.length})
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {DEMO_ADVISORIES.map((adv) => (
          <div
            key={adv.id}
            style={{
              border: '1px solid var(--border)',
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
                  <span className="font-mono text-sm" style={{ fontWeight: 500, fontSize: 13 }}>
                    {adv.packageName}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground ${SEVERITY_BADGE[adv.severity]}`}
                  >
                    {adv.severity}
                  </span>
                  {adv.cveId && (
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground font-mono text-sm">
                      {adv.cveId}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 12, marginBottom: 4 }}>
                  Installed: <span className="font-mono text-sm">{adv.installedVersion}</span>
                  {' â†’ '}
                  Fix: <span className="font-mono text-sm">{adv.fixedVersion}</span>
                </p>
                <p style={{ fontSize: 13 }}>{adv.description}</p>
              </div>
            </div>

            <div
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}
            >
              <span
                className={`inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground ${ACTION_BADGE[adv.recommendedAction]}`}
              >
                {ACTION_LABEL[adv.recommendedAction]}
              </span>
              <Button size="sm" type="button">
                Create Change Request
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
