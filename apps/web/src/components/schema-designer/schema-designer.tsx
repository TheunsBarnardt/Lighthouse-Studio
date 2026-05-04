'use client';

import { ReactFlowProvider } from '@xyflow/react';
import { useEffect } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useDesignerStore, type DesignerView } from '@/state/designer-store';

import { CodeView } from './code-view/code-view';
import { DiagramView } from './diagram-view/diagram-view';
import { ConflictModal } from './lifecycle/conflict-modal';
import { DeployBar } from './lifecycle/deploy-bar';
import { ValidationBanner } from './lifecycle/validation-banner';
import { TableView } from './table-view/table-view';

const VIEWS: { id: DesignerView; label: string }[] = [
  { id: 'diagram', label: 'Diagram' },
  { id: 'table', label: 'Table' },
  { id: 'code', label: 'Code' },
];

interface SchemaDesignerProps {
  workspaceId: string;
  schemaId: string;
}

export function SchemaDesigner({ workspaceId, schemaId }: SchemaDesignerProps) {
  const setWorkspaceId = useDesignerStore((s) => s.setWorkspaceId);
  const loadSchema = useDesignerStore((s) => s.loadSchema);
  const selectedView = useDesignerStore((s) => s.selectedView);
  const changeView = useDesignerStore((s) => s.changeView);
  const isDirty = useDesignerStore((s) => s.isDirty);
  const isLoading = useDesignerStore((s) => s.isLoading);
  const error = useDesignerStore((s) => s.error);
  const clearError = useDesignerStore((s) => s.clearError);
  const schema = useDesignerStore((s) => s.schema);

  useEffect(() => {
    setWorkspaceId(workspaceId);
    void loadSchema(schemaId);
  }, [workspaceId, schemaId, setWorkspaceId, loadSchema]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="rounded-lg border border-error/40 bg-error/5 p-6 text-center">
          <p className="text-error">{error}</p>
          <Button className="mt-4" onClick={clearError} variant="outline" size="sm">
            Dismiss
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading && !schema) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading schema…
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* View switcher tabs */}
      <div
        className="flex items-center gap-1 border-b px-4 py-2"
        role="tablist"
        aria-label="Schema views"
      >
        {VIEWS.map((view) => (
          <button
            key={view.id}
            role="tab"
            aria-selected={selectedView === view.id}
            aria-controls={`view-panel-${view.id}`}
            className={cn(
              'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
              selectedView === view.id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
            onClick={() => {
              changeView(view.id);
            }}
          >
            {view.label}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-3">
          {isDirty && (
            <Badge variant="warning" aria-label="Unsaved changes">
              Unsaved
            </Badge>
          )}
          {schema && (
            <span className="text-xs text-muted-foreground">
              v{schema.version} · {schema.databaseDriver}
            </span>
          )}
        </div>
      </div>

      {/* Validation banner (sticky below tabs) */}
      <ValidationBanner />

      {/* View panels */}
      <div className="relative flex-1 overflow-hidden">
        <div
          id="view-panel-diagram"
          role="tabpanel"
          aria-labelledby="tab-diagram"
          hidden={selectedView !== 'diagram'}
          className="h-full"
        >
          {selectedView === 'diagram' && (
            <ReactFlowProvider>
              <DiagramView />
            </ReactFlowProvider>
          )}
        </div>

        <div
          id="view-panel-table"
          role="tabpanel"
          aria-labelledby="tab-table"
          hidden={selectedView !== 'table'}
          className="h-full"
        >
          {selectedView === 'table' && <TableView />}
        </div>

        <div
          id="view-panel-code"
          role="tabpanel"
          aria-labelledby="tab-code"
          hidden={selectedView !== 'code'}
          className="h-full"
        >
          {selectedView === 'code' && <CodeView />}
        </div>
      </div>

      {/* Deploy bar (sticky at bottom) */}
      <DeployBar />

      {/* Conflict resolution modal (shown when a 409 occurs during deploy) */}
      <ConflictModal />
    </div>
  );
}
