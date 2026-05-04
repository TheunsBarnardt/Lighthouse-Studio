import type { Meta, StoryObj } from '@storybook/react';

import { useEffect } from 'react';

import type { CustomerSchema } from '@/lib/types';

import { useDesignerStore } from '@/state/designer-store';

import { CodeView } from './code-view';

const meta: Meta<typeof CodeView> = {
  component: CodeView,
  title: 'Schema Designer/CodeView',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof CodeView>;

const mockSchema: CustomerSchema = {
  id: 'sch-1',
  workspaceId: 'ws-1',
  name: 'My Schema',
  slug: 'my-schema',
  version: 1,
  databaseDriver: 'postgres',
  tables: [
    {
      id: 'tbl-1',
      name: 'users',
      columns: [
        { id: 'c1', name: 'id', type: { kind: 'uuid' }, nullable: false },
        {
          id: 'c2',
          name: 'email',
          type: { kind: 'string', length: 255 },
          nullable: false,
          isPii: true,
          piiCategory: 'contact',
        },
      ],
      primaryKey: { kind: 'single', columnId: 'c1' },
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
      <CodeView />
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
        <CodeView />
      </div>
    );
  },
};
