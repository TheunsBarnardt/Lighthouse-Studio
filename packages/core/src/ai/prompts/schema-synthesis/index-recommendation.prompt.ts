import { z } from 'zod';
import { definePrompt, registerPrompt } from '../registry.js';

const inputs = z.object({
  tables: z.array(z.object({
    id: z.string(), name: z.string(),
    columns: z.array(z.object({ id: z.string(), name: z.string(), isForeignKey: z.boolean() })),
  })),
  filterableColumns: z.array(z.object({ tableId: z.string(), columnId: z.string(), reason: z.string() })),
  databaseDriver: z.enum(['postgres', 'mssql', 'mongo']),
  preferredIndexTypes: z.array(z.string()),
});

const outputs = z.object({
  recommendations: z.array(z.object({
    tableId: z.string(),
    columnIds: z.array(z.string()),
    type: z.string(),
    reasoning: z.string(),
    estimatedBenefit: z.enum(['high', 'medium', 'low']),
    prdJustification: z.string().optional(),
  })),
  reasoning: z.string(),
});

export const indexRecommendationPrompt = definePrompt({
  id: 'schema-synthesis.index-recommendation',
  version: '1.0.0',
  description: 'Recommend indexes based on tables, FK columns, and filterable columns from PRD',
  inputs,
  outputs,
  modelConfig: { model: 'claude-haiku-4-5-20251001', maxTokens: 1500, temperature: 0.1 },
  systemPrompt: `Recommend database indexes. Always index: PK columns (already indexed), FK columns (always add). Also index: columns marked filterable or sortable in PRD. For Postgres: use GIN for JSONB, btree for everything else. For MSSQL: nonclustered for most. For Mongo: single or compound. Be conservative — indexes have write costs. Do not index every column.`,
  userPromptTemplate: `Tables: {{tables}}
Filterable columns from PRD: {{filterableColumns}}
Database: {{databaseDriver}}
Available index types: {{preferredIndexTypes}}

Recommend indexes for this schema.`,
  tests: [
    {
      name: 'recommends FK indexes',
      input: {
        tables: [{ id: 'tbl_posts', name: 'posts', columns: [{ id: 'col_author', name: 'author_id', isForeignKey: true }] }],
        filterableColumns: [],
        databaseDriver: 'postgres',
        preferredIndexTypes: ['btree'],
      },
      assertions: [
        (output: z.infer<typeof outputs>) => output.recommendations.some(r => r.tableId === 'tbl_posts'),
      ],
    },
  ],
});

registerPrompt(indexRecommendationPrompt);
