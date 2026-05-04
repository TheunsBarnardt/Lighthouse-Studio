import type { Meta, StoryObj } from '@storybook/react';

import { ReactFlowProvider } from '@xyflow/react';
import { useEffect } from 'react';

import type { CustomerSchema } from '@/lib/types';

import { useDesignerStore } from '@/state/designer-store';

import { DiagramView } from './diagram-view';

const meta: Meta<typeof DiagramView> = {
  component: DiagramView,
  title: 'Schema Designer/DiagramView',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <ReactFlowProvider>
        <Story />
      </ReactFlowProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof DiagramView>;

const mockSchema: CustomerSchema = {
  id: 'sch-1',
  workspaceId: 'ws-1',
  name: 'Blog',
  slug: 'blog',
  version: 1,
  databaseDriver: 'postgres',
  tables: [
    {
      id: 'tbl-1',
      name: 'posts',
      columns: [
        { id: 'c1', name: 'id', type: { kind: 'uuid' }, nullable: false },
        { id: 'c2', name: 'author_id', type: { kind: 'uuid' }, nullable: false },
        { id: 'c3', name: 'title', type: { kind: 'string', length: 255 }, nullable: false },
      ],
      primaryKey: { kind: 'single', columnId: 'c1' },
      indexes: [],
      foreignKeys: [
        {
          id: 'fk-1',
          name: 'fk_author',
          columnIds: ['c2'],
          referencedTableId: 'tbl-2',
          referencedColumnIds: ['c4'],
        },
      ],
      constraints: [],
    },
    {
      id: 'tbl-2',
      name: 'users',
      columns: [
        { id: 'c4', name: 'id', type: { kind: 'uuid' }, nullable: false },
        { id: 'c5', name: 'email', type: { kind: 'string', length: 255 }, nullable: false },
      ],
      primaryKey: { kind: 'single', columnId: 'c4' },
      indexes: [],
      foreignKeys: [],
      constraints: [],
    },
  ],
  metadata: {},
} as unknown as CustomerSchema;

function WithSchema() {
  useEffect(() => {
    useDesignerStore.setState({ schema: mockSchema });
    return () => {
      useDesignerStore.setState({ schema: null });
    };
  }, []);
  return (
    <div style={{ height: '600px' }}>
      <DiagramView />
    </div>
  );
}

export const Default: Story = { render: () => <WithSchema /> };

export const NoSchema: Story = {
  render: () => {
    useEffect(() => {
      useDesignerStore.setState({ schema: null });
    }, []);
    return (
      <div style={{ height: '300px' }}>
        <DiagramView />
      </div>
    );
  },
};
