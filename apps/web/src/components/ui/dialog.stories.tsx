import type { Meta, StoryObj } from '@storybook/react';

import { useState } from 'react';

import { Button } from './button';
import { Dialog, DialogFooter } from './dialog';

const meta: Meta<typeof Dialog> = {
  component: Dialog,
  title: 'UI/Dialog',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Dialog>;

function Controlled({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Button
        onClick={() => {
          setOpen(true);
        }}
      >
        Open
      </Button>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
        }}
        title="Dialog title"
        description="A description of what this dialog does."
        size={size}
      >
        <p className="text-sm text-muted-foreground">Dialog body content goes here.</p>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setOpen(false);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              setOpen(false);
            }}
          >
            Confirm
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}

export const Default: Story = { render: () => <Controlled /> };
export const Small: Story = { render: () => <Controlled size="sm" /> };
export const Large: Story = { render: () => <Controlled size="lg" /> };
