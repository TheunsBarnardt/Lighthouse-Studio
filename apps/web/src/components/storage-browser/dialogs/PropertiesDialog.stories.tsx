import type { Meta, StoryObj } from '@storybook/react';

import { PropertiesDialog } from './PropertiesDialog';

const meta: Meta<typeof PropertiesDialog> = {
  component: PropertiesDialog,
  title: 'Storage Browser/PropertiesDialog',
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof PropertiesDialog>;

const mockFile = {
  id: 'f-01',
  bucketId: 'b-01',
  filename: 'customer-data-2024-q1.csv',
  folderPath: 'exports/customers',
  sizeBytes: 1_048_576,
  contentType: 'text/csv',
  tags: ['customers', 'export', '2024'],
  piiFlag: true,
  status: 'available' as const,
  uploaderUserId: 'user-123',
  createdAt: new Date('2024-01-15T09:00:00Z').toISOString(),
  updatedAt: new Date('2024-01-20T14:30:00Z').toISOString(),
  etag: 'abc123def456',
};

export const Default: Story = {
  args: {
    file: mockFile,
    onSaveTags: () => Promise.resolve(undefined),
    onSaveMetadata: () => Promise.resolve(undefined),
    onClose: () => {},
  },
};

export const NoPii: Story = {
  args: {
    file: { ...mockFile, piiFlag: false, tags: ['public', 'docs'] },
    onSaveTags: () => Promise.resolve(undefined),
    onSaveMetadata: () => Promise.resolve(undefined),
    onClose: () => {},
  },
};
