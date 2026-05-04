import type { Meta, StoryObj } from '@storybook/react';

import { useEffect } from 'react';

import type { ValidationReport } from '@/lib/types';

import { useDesignerStore } from '@/state/designer-store';

import { ValidationBanner } from './validation-banner';

const meta: Meta<typeof ValidationBanner> = {
  component: ValidationBanner,
  title: 'Schema Designer/ValidationBanner',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ValidationBanner>;

function WithReport({ report }: { report: ValidationReport }) {
  const store = useDesignerStore;
  useEffect(() => {
    store.setState({ validationReport: report });
    return () => {
      store.setState({ validationReport: null });
    };
  }, []);
  return <ValidationBanner />;
}

export const Valid: Story = {
  render: () => <WithReport report={{ valid: true, errors: [], warnings: [], info: [] }} />,
};

export const WithErrors: Story = {
  render: () => (
    <WithReport
      report={{
        valid: false,
        errors: [
          {
            path: 'tables[0].name',
            code: 'RESERVED_WORD',
            severity: 'error',
            message: '"user" is a reserved word in PostgreSQL.',
          },
        ],
        warnings: [
          {
            path: 'tables[0].columns[0]',
            code: 'MISSING_INDEX',
            severity: 'warning',
            message: 'Foreign key column has no index.',
          },
        ],
        info: [],
      }}
    />
  ),
};

export const WithWarningsOnly: Story = {
  render: () => (
    <WithReport
      report={{
        valid: true,
        errors: [],
        warnings: [
          {
            path: 'tables[0]',
            code: 'ADVISORY_FK',
            severity: 'warning',
            message: 'Foreign key is advisory only on MongoDB.',
          },
        ],
        info: [
          {
            path: 'tables[0].columns[2]',
            code: 'PII_HINT',
            severity: 'info',
            message: 'Column "email" looks like PII. Consider marking it.',
          },
        ],
      }}
    />
  ),
};
