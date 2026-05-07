'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Download, CheckCircle2 } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export function ExportDialog({ onClose }: Props) {
  const [step, setStep] = useState<'config' | 'generating' | 'ready'>('config');
  const [telemetryEnabled, setTelemetryEnabled] = useState(true);
  const [version, setVersion] = useState('v0.1.0');

  const handleExport = () => {
    setStep('generating');
    setTimeout(() => setStep('ready'), 3000);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export Documentation Site</DialogTitle>
        </DialogHeader>

        {step === 'config' && (
          <>
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Generate a standalone Next.js + fumadocs documentation site.
                The export is a zip file that can be deployed to any static host.
              </p>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Version tag</label>
                <input
                  value={version}
                  onChange={e => setVersion(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={telemetryEnabled}
                  onChange={e => setTelemetryEnabled(e.target.checked)}
                  className="mt-0.5 rounded"
                />
                <div>
                  <p className="text-sm font-medium">Include telemetry</p>
                  <p className="text-xs text-muted-foreground">
                    The exported site will send anonymised page-view events back to this platform.
                    No PII is collected. You can disable this at any time by editing <code className="font-mono">lib/telemetry.ts</code>.
                  </p>
                </div>
              </label>

              <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">What gets exported</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>All published documentation pages as MDX</li>
                  <li>Next.js + fumadocs project scaffold</li>
                  <li>Static search index</li>
                  {telemetryEnabled && <li>Telemetry beacon (<code>lib/telemetry.ts</code>)</li>}
                  <li>Workspace brand assets (logo, colors)</li>
                </ul>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export {version}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'generating' && (
          <div className="py-8 flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="text-center">
              <p className="font-medium">Generating documentation site…</p>
              <p className="text-sm text-muted-foreground mt-1">Building MDX pages, search index, and scaffold</p>
            </div>
          </div>
        )}

        {step === 'ready' && (
          <>
            <div className="py-4 flex flex-col items-center gap-4">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
              <div className="text-center">
                <p className="font-semibold">Export ready</p>
                <p className="text-sm text-muted-foreground mt-1">
                  <Badge variant="outline" className="font-mono">{version}</Badge>
                  {' · '}~18 MB · fumadocs + Next.js
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Close</Button>
              <Button>
                <Download className="h-4 w-4 mr-2" />
                Download ZIP
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
