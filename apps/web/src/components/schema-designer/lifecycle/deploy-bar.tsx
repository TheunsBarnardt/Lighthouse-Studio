'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogFooter } from '@/components/ui/dialog';
import { useDesignerStore, selectCanDeploy, selectHasErrors } from '@/state/designer-store';

export function DeployBar() {
  const isDirty = useDesignerStore((s) => s.isDirty);
  const isLoading = useDesignerStore((s) => s.isLoading);
  const canDeploy = useDesignerStore(selectCanDeploy);
  const hasErrors = useDesignerStore(selectHasErrors);
  const migrationPreview = useDesignerStore((s) => s.migrationPreview);
  const validateChanges = useDesignerStore((s) => s.validateChanges);
  const previewMigration = useDesignerStore((s) => s.previewMigration);
  const applyMigration = useDesignerStore((s) => s.applyMigration);
  const resetToDeployed = useDesignerStore((s) => s.resetToDeployed);
  const validationReport = useDesignerStore((s) => s.validationReport);

  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  if (!isDirty) return null;

  const handleValidate = () => {
    void validateChanges();
  };

  const handlePreview = async () => {
    await previewMigration();
    setShowPreviewModal(true);
  };

  const handleApply = async () => {
    setShowConfirmModal(false);
    await applyMigration();
  };

  const plan = migrationPreview?.plan;

  return (
    <>
      <div
        className="flex items-center gap-3 border-t bg-card px-4 py-3"
        role="toolbar"
        aria-label="Deploy actions"
      >
        <span className="flex-1 text-xs text-muted-foreground">You have unsaved changes.</span>

        <Button variant="ghost" size="sm" onClick={resetToDeployed} disabled={isLoading}>
          Discard
        </Button>

        {!validationReport && (
          <Button variant="outline" size="sm" onClick={handleValidate} disabled={isLoading}>
            {isLoading ? 'Validating…' : 'Validate'}
          </Button>
        )}

        {validationReport && !hasErrors && !migrationPreview && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void handlePreview();
            }}
            disabled={isLoading}
          >
            {isLoading ? 'Previewing…' : 'Preview Migration'}
          </Button>
        )}

        <Button
          size="sm"
          onClick={() => {
            setShowConfirmModal(true);
          }}
          disabled={!canDeploy || isLoading}
          aria-label={canDeploy ? 'Deploy schema' : 'Validate then preview before deploying'}
          title={!canDeploy ? 'Validate and preview migration first' : undefined}
        >
          Deploy
        </Button>
      </div>

      {/* Preview modal */}
      <Dialog
        open={showPreviewModal}
        onClose={() => {
          setShowPreviewModal(false);
        }}
        title="Migration Preview"
        description={`${String(plan?.steps.length ?? 0)} steps · estimated ${String(Math.round((plan?.estimatedTotalDurationMs ?? 0) / 1000))}s`}
        size="lg"
      >
        {plan?.dataLossRisk && (
          <div className="mb-4 rounded-lg bg-error/10 p-3 text-sm text-error">
            ⚠ This migration may cause <strong>data loss</strong>. Review destructive changes
            below.
          </div>
        )}

        <div className="space-y-2">
          {plan?.destructiveChanges.map((dc, i) => (
            <div key={i} className="rounded border border-error/30 bg-error/5 px-3 py-2 text-sm">
              {dc.description}
            </div>
          ))}
          {plan?.steps.map((step) => (
            <div key={step.id} className="rounded border px-3 py-2 text-sm">
              <div className="font-medium">{step.description}</div>
              {step.ddl && (
                <pre className="mt-1 overflow-auto font-mono text-xs text-muted-foreground">
                  {step.ddl}
                </pre>
              )}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setShowPreviewModal(false);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              setShowPreviewModal(false);
              setShowConfirmModal(true);
            }}
          >
            Proceed to Deploy
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Confirm deploy modal */}
      <Dialog
        open={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false);
        }}
        title="Confirm Deployment"
        description="This will apply the migration to the live database. This action cannot be undone without a rollback."
        size="sm"
      >
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setShowConfirmModal(false);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              void handleApply();
            }}
            disabled={isLoading}
          >
            {isLoading ? 'Deploying…' : 'Deploy'}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
