import type { Meta, StoryObj } from '@storybook/react';

import { Button } from './button';
import { Tooltip } from './tooltip';

const meta: Meta<typeof Tooltip> = {
  component: Tooltip,
  title: 'UI/Tooltip',
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof Tooltip>;

export const Top: Story = {
  render: () => (
    <Tooltip content="Array columns are not supported on MSSQL" side="top">
      <Button variant="outline">Hover me</Button>
    </Tooltip>
  ),
};

export const Bottom: Story = {
  render: () => (
    <Tooltip content="Tooltip below" side="bottom">
      <Button variant="outline">Hover me</Button>
    </Tooltip>
  ),
};

export const WithLink: Story = {
  render: () => (
    <Tooltip
      content={
        <>
          Not supported.{' '}
          <a href="#" className="underline">
            See capability matrix
          </a>
        </>
      }
      side="top"
    >
      <Button variant="outline" disabled>
        Array type
      </Button>
    </Tooltip>
  ),
};
