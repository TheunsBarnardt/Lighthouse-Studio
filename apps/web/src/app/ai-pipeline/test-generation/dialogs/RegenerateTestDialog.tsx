'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface Props {
  testFileId: string;
  onClose(): void;
}

export function RegenerateTestDialog({ testFileId, onClose }: Props) {
  const [feedback, setFeedback] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    await new Promise(r => setTimeout(r, 1800));
    setIsRegenerating(false);
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Regenerate Test</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="feedback">Feedback (optional)</Label>
            <Textarea
              id="feedback"
              placeholder="e.g. Add a test for the case where email already exists. Use async/await instead of promise chains."
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              rows={4}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Leave blank to regenerate with the same specification. Provide feedback to guide the changes.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isRegenerating}>Cancel</Button>
          <Button onClick={handleRegenerate} disabled={isRegenerating}>
            {isRegenerating ? 'Regenerating…' : 'Regenerate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
