import type { Meta, StoryObj } from '@storybook/react';

import { useEffect } from 'react';

import type { CustomerSchema } from '@/lib/types';

import { useDesignerStore } from '@/state/designer-store';

import { TableView } from './table-view';

const meta: Meta<typeof TableView> = {
  component: TableView,
  title: 'Schema Designer/TableView',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof TableView>;

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
        { id: 'c2', name: 'title', type: { kind: 'string', length: 255 }, nullable: false },
        { id: 'c3', name: 'body', type: { kind: 'text' }, nullable: true },
        { id: 'c4', name: 'author_email', type: { kind: 'string', length: 255 }, nullable: false },
      ],
      primaryKey: { kind: 'single', columnId: 'c1' },
      indexes: [],
      foreignKeys: [],
      constraints: [],
    },
    {
      id: 'tbl-2',
      name: 'comments',
      columns: [
        { id: 'c5', name: 'id', type: { kind: 'uuid' }, nullable: false },
        { id: 'c6', name: 'content', type: { kind: 'text' }, nullable: false },
      ],
      primaryKey: { kind: 'single', columnId: 'c5' },
      indexes: [],
      foreignKeys: [],
      constraints: [],
    },
  ],
  metadata: {},
} as unknown as CustomerSchema;

function WithSchema({ schema }: { schema: CustomerSchema }) {
  useEffect(() => {
    useDesignerStore.setState({ schema, selectedTableId: schema.tables[0]?.id ?? null });
    return () => {
      useDesignerStore.setState({ schema: null, selectedTableId: null });
    };
  }, [schema]);
  return (
    <div style={{ height: '600px' }}>
      <TableView />
    </div>
  );
}

export const Default: Story = { render: () => <WithSchema schema={mockSchema} /> };

export const MongoWithFk: Story = {
  render: () => (
    <WithSchema
      schema={
        {
          ...mockSchema,
          databaseDriver: 'mongo',
          tables: [
            {
              ...mockSchema.tables[0],
              foreignKeys: [
                {
                  id: 'fk-1',
                  name: 'fk_author',
                  columnIds: ['c4'],
                  referencedTableId: 'tbl-2',
                  referencedColumnIds: ['c5'],
                },
              ],
            },
          ],
        } as unknown as CustomerSchema
      }
    />
  ),
};

export const NoSchema: Story = {
  render: () => {
    useEffect(() => {
      useDesignerStore.setState({ schema: null });
    }, []);
    return <TableView />;
  },
};
