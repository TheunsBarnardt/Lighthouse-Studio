import type { Meta, StoryObj } from '@storybook/react';

import { Badge } from './badge';

const meta: Meta<typeof Badge> = {
  component: Badge,
  title: 'UI/Badge',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = { args: { children: 'Badge' } };
export const Secondary: Story = { args: { children: 'Secondary', variant: 'secondary' } };
export const Error: Story = { args: { children: 'Error', variant: 'error' } };
export const Warning: Story = { args: { children: 'Warning', variant: 'warning' } };
export const Success: Story = { args: { children: 'Success', variant: 'success' } };
