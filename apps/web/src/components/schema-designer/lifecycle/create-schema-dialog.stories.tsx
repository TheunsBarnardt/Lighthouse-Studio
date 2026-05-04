import type { Meta, StoryObj } from '@storybook/react';

import { useState } from 'react';

import { Button } from '@/components/ui/button';

import { CreateSchemaDialog } from './create-schema-dialog';

const meta: Meta<typeof CreateSchemaDialog> = {
  component: CreateSchemaDialog,
  title: 'Schema Designer/CreateSchemaDialog',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof CreateSchemaDialog>;

function Controlled() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Button
        onClick={() => {
          setOpen(true);
        }}
      >
        Open Create Dialog
      </Button>
      <CreateSchemaDialog
        workspaceId="ws-1"
        open={open}
        onClose={() => {
          setOpen(false);
        }}
      />
    </>
  );
}

export const Default: Story = { render: () => <Controlled /> };
