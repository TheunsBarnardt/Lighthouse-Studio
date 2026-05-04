import type { Meta, StoryObj } from '@storybook/react';

import { useEffect } from 'react';

import type { CustomerSchema } from '@/lib/types';

import { useDesignerStore } from '@/state/designer-store';

import { ConflictModal } from './conflict-modal';

const meta: Meta<typeof ConflictModal> = {
  component: ConflictModal,
  title: 'Schema Designer/ConflictModal',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ConflictModal>;

const mockServer: CustomerSchema = {
  id: 'sch-1',
  workspaceId: 'ws-1',
  name: 'My Schema',
  slug: 'my-schema',
  version: 4,
  databaseDriver: 'postgres',
  tables: [],
  metadata: {},
} as unknown as CustomerSchema;

function WithConflict() {
  useEffect(() => {
    useDesignerStore.setState({
      schema: { ...mockServer, version: 3 } as CustomerSchema,
      conflictSchema: mockServer,
    });
    return () => {
      useDesignerStore.setState({ conflictSchema: null });
    };
  }, []);
  return <ConflictModal />;
}

export const Open: Story = {
  render: () => <WithConflict />,
};
