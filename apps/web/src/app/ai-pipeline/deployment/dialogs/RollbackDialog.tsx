'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';

interface Props {
  deploymentId: string;
  onClose(): void;
}

export function RollbackDialog({ deploymentId, onClose }: Props) {
  const [reason, setReason] = useState('');
  const [isRollingBack, setIsRollingBack] = useState(false);

  const handleRollback = async () => {
    setIsRollingBack(true);
    await new Promise(r => setTimeout(r, 2000));
    setIsRollingBack(false);
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rollback Deployment</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-800">
              <p className="font-medium mb-1">Rollback will revert</p>
              <ul className="space-y-0.5 text-xs">
                <li>• UI bundle to previous version</li>
                <li>• Server functions to previous version</li>
                <li>• Schema migrations (if reversible)</li>
              </ul>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea
              id="reason"
              placeholder="e.g. Health check failing after deploy. Users seeing 500 errors on checkout."
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isRollingBack}>Cancel</Button>
          <Button variant="destructive" onClick={handleRollback} disabled={isRollingBack}>
            {isRollingBack ? 'Rolling back…' : 'Initiate Rollback'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
