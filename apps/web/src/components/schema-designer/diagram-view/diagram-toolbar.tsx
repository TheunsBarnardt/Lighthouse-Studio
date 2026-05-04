'use client';

import { useReactFlow } from '@xyflow/react';

import { Button } from '@/components/ui/button';
import { newTable } from '@/lib/schema-utils';
import { useDesignerStore } from '@/state/designer-store';

export function DiagramToolbar() {
  const { fitView } = useReactFlow();
  const updateSchema = useDesignerStore((s) => s.updateSchema);

  const handleAddTable = () => {
    updateSchema((s) => {
      s.tables.push(newTable(s.id));
    });
  };

  return (
    <div
      className="absolute right-4 top-4 z-10 flex gap-2 rounded-lg border bg-card p-2 shadow-md"
      aria-label="Diagram toolbar"
    >
      <Button size="sm" variant="outline" onClick={handleAddTable} aria-label="Add table">
        + Table
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          void fitView({ padding: 0.2, duration: 400 });
        }}
        aria-label="Fit view"
      >
        Fit
      </Button>
    </div>
  );
}
