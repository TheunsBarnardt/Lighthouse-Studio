import type { Meta, StoryObj } from '@storybook/react';

import { useEffect } from 'react';

import type { CustomerSchema, MigrationPreview, ValidationReport } from '@/lib/types';

import { useDesignerStore } from '@/state/designer-store';

import { DeployBar } from './deploy-bar';

const meta: Meta<typeof DeployBar> = {
  component: DeployBar,
  title: 'Schema Designer/DeployBar',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof DeployBar>;

const mockSchema: CustomerSchema = {
  id: 'sch-1',
  workspaceId: 'ws-1',
  name: 'My Schema',
  slug: 'my-schema',
  version: 1,
  databaseDriver: 'postgres',
  tables: [],
  metadata: {},
} as unknown as CustomerSchema;

const validReport: ValidationReport = { valid: true, errors: [], warnings: [], info: [] };

const mockPreview: MigrationPreview = {
  steps: [{ order: 1, sql: 'CREATE TABLE users (id UUID PRIMARY KEY);', destructive: false }],
  estimatedDurationMs: 120,
  warnings: [],
} as unknown as MigrationPreview;

function WithState({
  dirty,
  report,
  preview,
}: {
  dirty: boolean;
  report?: ValidationReport;
  preview?: MigrationPreview;
}) {
  useEffect(() => {
    useDesignerStore.setState({
      schema: mockSchema,
      isDirty: dirty,
      validationReport: report ?? null,
      migrationPreview: preview ?? null,
    });
    return () => {
      useDesignerStore.setState({ isDirty: false, validationReport: null, migrationPreview: null });
    };
  }, []);
  return <DeployBar />;
}

export const DirtyNotValidated: Story = { render: () => <WithState dirty /> };
export const DirtyValidated: Story = { render: () => <WithState dirty report={validReport} /> };
export const DirtyWithPreview: Story = {
  render: () => <WithState dirty report={validReport} preview={mockPreview} />,
};
export const CleanHidden: Story = { render: () => <WithState dirty={false} /> };
