'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogFooter } from '@/components/ui/dialog';
import { useDesignerStore } from '@/state/designer-store';

export function ConflictModal() {
  const conflictSchema = useDesignerStore((s) => s.conflictSchema);
  const resolveConflict = useDesignerStore((s) => s.resolveConflict);
  const dismissConflict = useDesignerStore((s) => s.dismissConflict);
  const isLoading = useDesignerStore((s) => s.isLoading);
  const schema = useDesignerStore((s) => s.schema);

  const open = conflictSchema !== null;

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={dismissConflict}
      title="Deployment Conflict"
      description="Another client deployed a newer version while you were editing. How would you like to proceed?"
      size="md"
    >
      <div className="space-y-3 py-2 text-sm">
        <div className="rounded-lg border bg-card px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Your version</span>
            <span className="font-mono font-semibold">v{schema?.version ?? '?'}</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-muted-foreground">Server version</span>
            <span className="font-mono font-semibold text-warning">v{conflictSchema.version}</span>
          </div>
        </div>

        <p className="text-muted-foreground text-xs leading-relaxed">
          <strong className="text-foreground">Discard my changes</strong> — your edits will be lost;
          the schema resets to the server&apos;s current version.
          <br />
          <strong className="text-foreground">Overwrite server</strong> — your changes will be
          force-applied on top of the server version. Any changes made by the other client will be
          lost.
        </p>
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={dismissConflict} disabled={isLoading} aria-label="Cancel">
          Cancel
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            void resolveConflict('discard');
          }}
          disabled={isLoading}
          aria-label="Discard my changes and use server version"
        >
          Discard My Changes
        </Button>
        <Button
          variant="destructive"
          onClick={() => {
            void resolveConflict('overwrite');
          }}
          disabled={isLoading}
          aria-label="Force overwrite server with my changes"
        >
          {isLoading ? 'Applying…' : 'Overwrite Server'}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
