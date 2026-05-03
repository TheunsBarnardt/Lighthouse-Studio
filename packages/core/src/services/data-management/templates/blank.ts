import type { SchemaTemplate } from './index.js';

export const blankTemplate: SchemaTemplate = {
  id: 'tpl-blank',
  name: 'Blank schema',
  description:
    'Start with a single empty table. Add columns and relationships to build your schema.',
  tables: [
    {
      id: 'tpl-blank-tbl-items',
      name: 'items',
      description: 'Replace with your first table.',
      primaryKey: { kind: 'single', columnId: 'tpl-blank-col-items-id' },
      columns: [
        {
          id: 'tpl-blank-col-items-id',
          name: 'id',
          type: { kind: 'uuid' },
          nullable: false,
          defaultValue: { kind: 'function', name: 'gen_random_uuid' },
        },
        {
          id: 'tpl-blank-col-items-created-at',
          name: 'created_at',
          type: { kind: 'timestamp_tz' },
          nullable: false,
          defaultValue: { kind: 'function', name: 'now' },
        },
        {
          id: 'tpl-blank-col-items-updated-at',
          name: 'updated_at',
          type: { kind: 'timestamp_tz' },
          nullable: false,
          defaultValue: { kind: 'function', name: 'now' },
        },
      ],
      indexes: [],
      foreignKeys: [],
      constraints: [],
    },
  ],
};
