'use client';

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface Props {
  targetEnvironment: string;
  onClose(): void;
  onConfirm(): void;
}

export function PromoteDialog({ targetEnvironment, onClose, onConfirm }: Props) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Promote to {targetEnvironment}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground py-2">
          This will initiate a deployment to <strong className="text-foreground">{targetEnvironment}</strong>.
          {targetEnvironment === 'prod' && ' Tests must pass and approvals from architect and workspace owner are required.'}
          {targetEnvironment === 'staging' && ' Tests will run before the deployment proceeds.'}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onConfirm}>Promote to {targetEnvironment}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
