import type { Meta, StoryObj } from '@storybook/react';

import { ReactFlowProvider } from '@xyflow/react';

import type { TableDefinition } from '@/lib/types';

import { TableNode } from './table-node';

const meta: Meta<typeof TableNode> = {
  component: TableNode,
  title: 'Schema Designer/TableNode',
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <ReactFlowProvider>
        <div style={{ padding: 20 }}>
          <Story />
        </div>
      </ReactFlowProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof TableNode>;

const table: TableDefinition = {
  id: 'tbl-1',
  name: 'users',
  columns: [
    { id: 'c1', name: 'id', type: { kind: 'uuid' }, nullable: false },
    { id: 'c2', name: 'email', type: { kind: 'string', length: 255 }, nullable: false },
    { id: 'c3', name: 'created_at', type: { kind: 'timestamp_tz' }, nullable: false },
  ],
  primaryKey: { kind: 'single', columnId: 'c1' },
  indexes: [],
  foreignKeys: [],
  constraints: [],
};

const baseProps = {
  id: 'tbl-1',
  type: 'tableNode' as const,
  selected: false,
  dragging: false,
  zIndex: 1,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
};

export const Default: Story = {
  render: () => (
    <TableNode {...baseProps} data={{ table, selected: false, onSelect: () => undefined }} />
  ),
};

export const Selected: Story = {
  render: () => (
    <TableNode {...baseProps} data={{ table, selected: true, onSelect: () => undefined }} />
  ),
};

export const ManyColumns: Story = {
  render: () => {
    const manyColTable = {
      ...table,
      columns: Array.from({ length: 12 }, (_, i) => ({
        id: `c${String(i)}`,
        name: `column_${String(i)}`,
        type: { kind: 'text' as const },
        nullable: true,
      })),
    };
    return (
      <TableNode
        {...baseProps}
        data={{ table: manyColTable, selected: false, onSelect: () => undefined }}
      />
    );
  },
};
