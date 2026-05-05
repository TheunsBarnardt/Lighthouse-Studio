import type { Meta, StoryObj } from '@storybook/react';

import { UploadDialog } from './UploadDialog';

const meta: Meta<typeof UploadDialog> = {
  component: UploadDialog,
  title: 'Storage Browser/UploadDialog',
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof UploadDialog>;

export const Default: Story = {
  args: {
    bucketId: 'bucket-01',
    folderPath: 'documents/reports',
    onUpload: () => Promise.resolve(undefined),
    onClose: () => {},
  },
};

export const RootFolder: Story = {
  args: {
    bucketId: 'bucket-01',
    folderPath: '',
    onUpload: () => Promise.resolve(undefined),
    onClose: () => {},
  },
};
