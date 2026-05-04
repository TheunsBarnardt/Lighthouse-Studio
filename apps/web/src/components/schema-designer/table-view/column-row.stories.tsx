import type { Meta, StoryObj } from '@storybook/react';

import { useEffect } from 'react';

import type { ColumnDefinition, CustomerSchema } from '@/lib/types';

import { useDesignerStore } from '@/state/designer-store';

import { ColumnRow } from './column-row';

const meta: Meta<typeof ColumnRow> = {
  component: ColumnRow,
  title: 'Schema Designer/ColumnRow',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ColumnRow>;

const TABLE_ID = 'tbl-1';

const col: ColumnDefinition = {
  id: 'col-1',
  name: 'email',
  type: { kind: 'string', length: 255 },
  nullable: false,
};

const piiCol: ColumnDefinition = {
  id: 'col-2',
  name: 'email',
  type: { kind: 'string', length: 255 },
  nullable: false,
  isPii: true,
  piiCategory: 'contact',
};

const mockSchema: CustomerSchema = {
  id: 'sch-1',
  workspaceId: 'ws-1',
  name: 'My Schema',
  slug: 'my-schema',
  version: 1,
  databaseDriver: 'postgres',
  tables: [
    {
      id: TABLE_ID,
      name: 'users',
      columns: [col, piiCol],
      primaryKey: { kind: 'single', columnId: 'col-1' },
      indexes: [],
      foreignKeys: [],
      constraints: [],
    },
  ],
  metadata: {},
} as unknown as CustomerSchema;

function WithStore({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    useDesignerStore.setState({ schema: mockSchema });
    return () => {
      useDesignerStore.setState({ schema: null });
    };
  }, []);
  return (
    <table>
      <tbody>{children}</tbody>
    </table>
  );
}

export const Default: Story = {
  render: () => (
    <WithStore>
      <ColumnRow tableId={TABLE_ID} column={col} isPrimaryKey={false} driver="postgres" />
    </WithStore>
  ),
};

export const PrimaryKey: Story = {
  render: () => (
    <WithStore>
      <ColumnRow tableId={TABLE_ID} column={col} isPrimaryKey driver="postgres" />
    </WithStore>
  ),
};

export const WithPii: Story = {
  render: () => (
    <WithStore>
      <ColumnRow tableId={TABLE_ID} column={piiCol} isPrimaryKey={false} driver="postgres" />
    </WithStore>
  ),
};

export const MssqlArrayDisabled: Story = {
  render: () => (
    <WithStore>
      <ColumnRow
        tableId={TABLE_ID}
        column={{ ...col, type: { kind: 'array', elementType: { kind: 'text' } } }}
        isPrimaryKey={false}
        driver="mssql"
      />
    </WithStore>
  ),
};
