'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-gray-100 text-gray-700',
};

const ACTION_LABEL: Record<string, string> = {
  upgrade_now: 'Upgrade now',
  upgrade_soon: 'Upgrade soon',
  monitor: 'Monitor',
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
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
        <ShieldAlert className="h-8 w-8" />
        <p className="text-sm">No active advisories</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <h2 className="font-semibold">Dependency Advisories ({DEMO_ADVISORIES.length})</h2>

      <div className="space-y-3">
        {DEMO_ADVISORIES.map(adv => (
          <div key={adv.id} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-orange-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-medium font-mono text-sm">{adv.packageName}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${SEVERITY_BADGE[adv.severity]}`}>{adv.severity}</span>
                  {adv.cveId && <Badge variant="outline" className="text-xs font-mono">{adv.cveId}</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">
                  Installed: <span className="font-mono text-foreground">{adv.installedVersion}</span> →
                  Fix: <span className="font-mono text-green-700">{adv.fixedVersion}</span>
                </p>
                <p className="text-sm mt-1">{adv.description}</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Badge variant={adv.recommendedAction === 'upgrade_now' ? 'destructive' : 'secondary'} className="text-xs">
                {ACTION_LABEL[adv.recommendedAction]}
              </Badge>
              <Button size="sm">Create Change Request</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
