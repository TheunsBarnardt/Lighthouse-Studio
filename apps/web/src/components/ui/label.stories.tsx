import type { Meta, StoryObj } from '@storybook/react';

import { Input } from './input';
import { Label } from './label';

const meta: Meta<typeof Label> = {
  component: Label,
  title: 'UI/Label',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Label>;

export const Default: Story = { args: { children: 'Schema name', htmlFor: 'name-input' } };

export const WithInput: Story = {
  render: () => (
    <div className="space-y-1">
      <Label htmlFor="ex">Schema slug</Label>
      <Input id="ex" placeholder="my-schema" />
    </div>
  ),
};
