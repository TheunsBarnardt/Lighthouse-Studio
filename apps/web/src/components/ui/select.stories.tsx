import type { Meta, StoryObj } from '@storybook/react';

import { Select } from './select';

const meta: Meta<typeof Select> = {
  component: Select,
  title: 'UI/Select',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Select>;

export const Default: Story = {
  render: () => (
    <Select defaultValue="postgres">
      <option value="postgres">PostgreSQL</option>
      <option value="mssql">SQL Server (MSSQL)</option>
      <option value="mongo">MongoDB</option>
    </Select>
  ),
};

export const Disabled: Story = {
  render: () => (
    <Select disabled defaultValue="postgres">
      <option value="postgres">PostgreSQL</option>
    </Select>
  ),
};
