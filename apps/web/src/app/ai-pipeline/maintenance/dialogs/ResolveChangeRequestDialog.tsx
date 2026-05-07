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
import { Loader2 } from 'lucide-react';

interface Props {
  requestId: string;
  onClose: () => void;
}

type Resolution = 'fixed' | 'wont_fix' | 'duplicate' | 'by_design';

const RESOLUTIONS: { value: Resolution; label: string; description: string }[] = [
  { value: 'fixed', label: 'Fixed', description: 'The issue has been resolved through a pipeline re-engagement.' },
  { value: 'wont_fix', label: "Won't Fix", description: 'The issue has been acknowledged but will not be addressed.' },
  { value: 'duplicate', label: 'Duplicate', description: 'This is a duplicate of another change request.' },
  { value: 'by_design', label: 'By Design', description: 'The reported behaviour is intentional.' },
];

export function ResolveChangeRequestDialog({ requestId, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [resolution, setResolution] = useState<Resolution>('fixed');
  const [notes, setNotes] = useState('');

  const handleResolve = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onClose();
    }, 1200);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Resolve Change Request</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Resolution</p>
            <div className="space-y-2">
              {RESOLUTIONS.map(res => (
                <label key={res.value} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${resolution === res.value ? 'border-primary bg-primary/5' : 'hover:bg-muted/30'}`}>
                  <input
                    type="radio"
                    name="resolution"
                    value={res.value}
                    checked={resolution === res.value}
                    onChange={() => setResolution(res.value)}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium">{res.label}</p>
                    <p className="text-xs text-muted-foreground">{res.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Notes (optional)</label>
            <textarea
              className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              rows={3}
              placeholder="Any additional context about this resolution…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleResolve} disabled={loading}>
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Resolving…</> : 'Resolve'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
