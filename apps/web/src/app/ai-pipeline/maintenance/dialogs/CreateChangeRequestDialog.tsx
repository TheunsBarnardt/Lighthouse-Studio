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
import { Loader2 } from 'lucide-react';

interface Props {
  signalIds: string[];
  onClose: () => void;
}

const PRIORITY_OPTIONS = [
  { value: 'p0', label: 'P0 — Critical', className: 'bg-red-100 text-red-800' },
  { value: 'p1', label: 'P1 — High', className: 'bg-orange-100 text-orange-800' },
  { value: 'p2', label: 'P2 — Medium', className: 'bg-amber-100 text-amber-800' },
  { value: 'p3', label: 'P3 — Low', className: 'bg-gray-100 text-gray-700' },
];

export function CreateChangeRequestDialog({ signalIds, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [priority, setPriority] = useState('p1');

  const handleCreate = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onClose();
    }, 1500);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Change Request</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Creating from {signalIds.length} signal{signalIds.length !== 1 ? 's' : ''}.
              The AI will summarise the signals into a description and suggest affected pipeline stages.
            </p>
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-medium">Priority</p>
            <div className="flex gap-2 flex-wrap">
              {PRIORITY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setPriority(opt.value)}
                  className={`text-xs px-2 py-1 rounded font-medium border-2 transition-colors ${opt.className} ${priority === opt.value ? 'border-foreground' : 'border-transparent'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">What happens next</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>AI generates a description from the selected signals</li>
              <li>Affected pipeline stages are identified automatically</li>
              <li>Signals are linked and marked <Badge variant="secondary" className="text-xs">in change request</Badge></li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleCreate} disabled={loading}>
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating…</> : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
