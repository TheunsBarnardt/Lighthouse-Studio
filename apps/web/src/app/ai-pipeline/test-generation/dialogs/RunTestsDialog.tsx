'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type TestType = 'unit' | 'component' | 'integration' | 'e2e';

interface Props {
  onClose(): void;
  onStarted(): void;
}

const TEST_TYPES: { value: TestType; label: string; description: string }[] = [
  { value: 'unit', label: 'Unit Tests', description: 'Fast, isolated business logic tests' },
  { value: 'component', label: 'Component Tests', description: 'React component render and interaction tests' },
  { value: 'integration', label: 'Integration Tests', description: 'API and database tests (requires test DB)' },
  { value: 'e2e', label: 'E2E Tests', description: 'Full user journey tests via Playwright' },
];

export function RunTestsDialog({ onClose, onStarted }: Props) {
  const [selected, setSelected] = useState<Set<TestType>>(new Set(['unit', 'component']));
  const [deploymentUrl, setDeploymentUrl] = useState('');

  const toggle = (type: TestType) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  };

  const needsUrl = selected.has('e2e');

  const handleStart = () => {
    onStarted();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Run Tests</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">Select which test types to run.</p>

          <div className="space-y-2">
            {TEST_TYPES.map(t => (
              <div key={t.value} className="flex items-start gap-3 p-3 rounded-lg border">
                <Checkbox
                  id={t.value}
                  checked={selected.has(t.value)}
                  onCheckedChange={() => toggle(t.value)}
                  className="mt-0.5"
                />
                <div>
                  <label htmlFor={t.value} className="text-sm font-medium cursor-pointer">{t.label}</label>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                </div>
              </div>
            ))}
          </div>

          {needsUrl && (
            <div className="space-y-1.5">
              <Label htmlFor="deploymentUrl">Deployment URL (required for E2E)</Label>
              <Input
                id="deploymentUrl"
                placeholder="https://my-app.preview.platform.dev"
                value={deploymentUrl}
                onChange={e => setDeploymentUrl(e.target.value)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleStart}
            disabled={selected.size === 0 || (needsUrl && !deploymentUrl)}
          >
            Start Test Run
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
