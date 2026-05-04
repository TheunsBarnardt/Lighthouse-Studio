'use client';

import type { Edge, OnConnect, OnEdgesChange, OnNodesChange } from '@xyflow/react';

import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useEffect, useState } from 'react';

import { generateId } from '@/lib/schema-utils';
import { useDesignerStore } from '@/state/designer-store';

import type { TableNodeType } from './table-node';

import { DiagramToolbar } from './diagram-toolbar';
import { TableNode } from './table-node';

const nodeTypes = { tableNode: TableNode };

export function DiagramView() {
  const schema = useDesignerStore((s) => s.schema);
  const selectedTableId = useDesignerStore((s) => s.selectedTableId);
  const selectTable = useDesignerStore((s) => s.selectTable);
  const updateSchema = useDesignerStore((s) => s.updateSchema);

  const [nodes, setNodes] = useState<TableNodeType[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  // Build nodes from schema tables
  useEffect(() => {
    if (!schema) return;
    setNodes(
      schema.tables.map((table, i) => ({
        id: table.id,
        type: 'tableNode' as const,
        position: table._diagramPosition ?? {
          x: 100 + (i % 4) * 320,
          y: 100 + Math.floor(i / 4) * 220,
        },
        data: {
          table,
          selected: selectedTableId === table.id,
          onSelect: selectTable,
        },
        selected: selectedTableId === table.id,
      })),
    );

    // Build edges from foreign keys
    const fkEdges: Edge[] = [];
    for (const table of schema.tables) {
      for (const fk of table.foreignKeys) {
        fkEdges.push({
          id: fk.id,
          source: table.id,
          target: fk.referencedTableId,
          label: fk.name,
          type: 'smoothstep',
          animated: fk.advisory ?? false,
          style: { stroke: fk.advisory ? 'hsl(var(--color-warning))' : 'hsl(var(--color-border))' },
        });
      }
    }
    setEdges(fkEdges);
  }, [schema, selectedTableId, selectTable]);

  const onNodesChange: OnNodesChange<TableNodeType> = useCallback(
    (changes) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
      // Persist position changes to schema
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          const { id, position } = change;
          updateSchema((s) => {
            const table = s.tables.find((t) => t.id === id);
            if (table) table._diagramPosition = position;
          });
        }
      }
    },
    [updateSchema],
  );

  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  const onConnect: OnConnect = useCallback(
    (connection) => {
      if (!schema || !connection.source || !connection.target) return;
      const sourceTable = schema.tables.find((t) => t.id === connection.source);
      if (!sourceTable) return;

      // Add a placeholder FK (user fills in details in Table view)
      const fkId = generateId();
      updateSchema((s) => {
        const table = s.tables.find((t) => t.id === connection.source);
        if (!table) return;
        table.foreignKeys.push({
          id: fkId,
          name: `fk_${sourceTable.name}_ref`,
          columnIds: [],
          referencedTableId: connection.target,
          referencedColumnIds: [],
          advisory: s.databaseDriver === 'mongo',
        });
      });
      setEdges((eds) => addEdge({ ...connection, id: fkId, type: 'smoothstep' }, eds));
    },
    [schema, updateSchema],
  );

  if (!schema) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        No schema loaded.
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <DiagramToolbar />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        className="bg-muted/30"
        aria-label="Schema diagram"
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls />
        <MiniMap zoomable pannable />
      </ReactFlow>
    </div>
  );
}
