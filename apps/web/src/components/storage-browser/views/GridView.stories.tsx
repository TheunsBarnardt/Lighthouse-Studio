import type { Meta, StoryObj } from '@storybook/react';

import type { FileSummary } from '../types';

import { GridView } from './GridView';

const meta: Meta<typeof GridView> = {
  component: GridView,
  title: 'Storage Browser/GridView',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof GridView>;

const mockFiles: FileSummary[] = [
  {
    id: 'f1',
    bucketId: 'b1',
    filename: 'hero-image.png',
    folderPath: 'media',
    sizeBytes: 1_200_000,
    contentType: 'image/png',
    tags: ['brand', 'hero'],
    piiFlag: false,
    status: 'available',
    createdAt: new Date('2024-01-10').toISOString(),
    updatedAt: new Date('2024-01-10').toISOString(),
  },
  {
    id: 'f2',
    bucketId: 'b1',
    filename: 'product-demo.mp4',
    folderPath: 'media',
    sizeBytes: 52_428_800,
    contentType: 'video/mp4',
    tags: ['demo', 'product'],
    piiFlag: false,
    status: 'available',
    createdAt: new Date('2024-01-12').toISOString(),
    updatedAt: new Date('2024-01-12').toISOString(),
  },
  {
    id: 'f3',
    bucketId: 'b1',
    filename: 'spec.pdf',
    folderPath: '',
    sizeBytes: 340_000,
    contentType: 'application/pdf',
    tags: [],
    piiFlag: false,
    status: 'available',
    createdAt: new Date('2024-02-01').toISOString(),
    updatedAt: new Date('2024-02-01').toISOString(),
  },
  {
    id: 'f4',
    bucketId: 'b1',
    filename: 'customer-list.csv',
    folderPath: 'exports',
    sizeBytes: 95_000,
    contentType: 'text/csv',
    tags: ['pii', 'customers'],
    piiFlag: true,
    status: 'available',
    createdAt: new Date('2024-03-01').toISOString(),
    updatedAt: new Date('2024-03-01').toISOString(),
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
