import type { Meta, StoryObj } from '@storybook/react';

import type { FileSummary } from '../types';

import { ListView } from './ListView';

const meta: Meta<typeof ListView> = {
  component: ListView,
  title: 'Storage Browser/ListView',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof ListView>;

const mockFiles: FileSummary[] = [
  {
    id: 'f1',
    bucketId: 'b1',
    filename: 'annual-report-2024.pdf',
    folderPath: 'reports',
    sizeBytes: 2_048_000,
    contentType: 'application/pdf',
    tags: ['finance', 'confidential', '2024'],
    piiFlag: false,
    status: 'available',
    createdAt: new Date('2024-01-15').toISOString(),
    updatedAt: new Date('2024-01-20').toISOString(),
  },
  {
    id: 'f2',
    bucketId: 'b1',
    filename: 'customer-export.csv',
    folderPath: 'exports',
    sizeBytes: 512_000,
    contentType: 'text/csv',
    tags: ['customers', 'export'],
    piiFlag: true,
    status: 'available',
    createdAt: new Date('2024-02-01').toISOString(),
    updatedAt: new Date('2024-02-01').toISOString(),
  },
  {
    id: 'f3',
    bucketId: 'b1',
    filename: 'logo.png',
    folderPath: '',
    sizeBytes: 45_000,
    contentType: 'image/png',
    tags: ['brand'],
    piiFlag: false,
    status: 'available',
    createdAt: new Date('2024-03-10').toISOString(),
    updatedAt: new Date('2024-03-10').toISOString(),
  },
];

export const Default: Story = {
  args: {
    files: mockFiles,
    selectedFileIds: new Set(),
    onSelectFile: () => {},
    onOpenPreview: () => {},
    onContextMenu: () => {},
  },
};

export const WithSelection: Story = {
  args: {
    files: mockFiles,
    selectedFileIds: new Set(['f1', 'f3']),
    onSelectFile: () => {},
    onOpenPreview: () => {},
    onContextMenu: () => {},
  },
};

export const Empty: Story = {
  args: {
    files: [],
    selectedFileIds: new Set(),
    onSelectFile: () => {},
    onOpenPreview: () => {},
    onContextMenu: () => {},
  },
};
