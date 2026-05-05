import type { Meta, StoryObj } from '@storybook/react';

import { QuotaPanel } from './QuotaPanel';

const meta: Meta<typeof QuotaPanel> = {
  component: QuotaPanel,
  title: 'Storage Browser/QuotaPanel',
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof QuotaPanel>;

const GB = 1024 * 1024 * 1024;

export const Normal: Story = {
  args: {
    quota: { quotaBytes: 100 * GB, usedBytes: 20 * GB, usedPercent: 0.2 },
  },
};

export const Warning80: Story = {
  args: {
    quota: { quotaBytes: 100 * GB, usedBytes: 83 * GB, usedPercent: 0.83 },
  },
};

export const Critical95: Story = {
  args: {
    quota: { quotaBytes: 100 * GB, usedBytes: 97 * GB, usedPercent: 0.97 },
  },
};

export const Empty: Story = {
  args: {
    quota: null,
  },
};
