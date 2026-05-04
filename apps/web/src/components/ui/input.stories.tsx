import type { Meta, StoryObj } from '@storybook/react';

import { Input } from './input';

const meta: Meta<typeof Input> = {
  component: Input,
  title: 'UI/Input',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = { args: { placeholder: 'Enter value…' } };
export const WithValue: Story = { args: { defaultValue: 'my-schema' } };
export const Disabled: Story = { args: { disabled: true, defaultValue: 'read-only' } };
export const Error: Story = {
  args: { 'aria-invalid': true, defaultValue: 'bad-value!', placeholder: 'Enter slug' },
};
