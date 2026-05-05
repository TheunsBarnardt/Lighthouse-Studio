import type { RequestContext } from '@platform/ports-authorization';
import type { QueryLanguage } from '@platform/ports-persistence';

import type { SchemaService } from '../schema.service.js';

// ── Completion item ───────────────────────────────────────────────────────────

export interface CompletionItem {
  label: string;
  kind: 'table' | 'column' | 'keyword' | 'function' | 'operator';
  detail?: string;
  insertText?: string;
  sortText?: string;
}

// ── SQL keyword sets ──────────────────────────────────────────────────────────

const PG_KEYWORDS = [
  'SELECT',
  'FROM',
  'WHERE',
  'JOIN',
  'LEFT',
  'RIGHT',
  'INNER',
  'OUTER',
  'FULL',
  'ON',
  'AND',
  'OR',
  'NOT',
  'IN',
  'EXISTS',
  'BETWEEN',
  'LIKE',
  'ILIKE',
  'ORDER',
  'BY',
  'GROUP',
  'HAVING',
  'LIMIT',
  'OFFSET',
  'DISTINCT',
  'AS',
  'WITH',
  'UNION',
  'INTERSECT',
  'EXCEPT',
  'ALL',
  'INSERT',
  'UPDATE',
  'DELETE',
  'INTO',
  'VALUES',
  'SET',
  'RETURNING',
  'CASE',
  'WHEN',
  'THEN',
  'ELSE',
  'END',
  'IS',
  'NULL',
  'TRUE',
  'FALSE',
  'CAST',
  'COALESCE',
  'NULLIF',
  'ASC',
  'DESC',
];

const PG_FUNCTIONS = [
  'now()',
  'current_timestamp',
  'current_date',
  'current_time',
  'count(*)',
  'count(1)',
  'sum()',
  'avg()',
  'min()',
  'max()',
  'coalesce()',
  'nullif()',
  'greatest()',
  'least()',
  'length()',
  'lower()',
  'upper()',
  'trim()',
  'substring()',
  'to_char()',
  'to_timestamp()',
  'date_trunc()',
  'json_build_object()',
  'jsonb_build_object()',
  'gen_random_uuid()',
];

const MSSQL_KEYWORDS = [
  'SELECT',
  'TOP',
  'FROM',
  'WHERE',
  'JOIN',
  'LEFT',
  'RIGHT',
  'INNER',
  'OUTER',
  'ON',
  'AND',
  'OR',
  'NOT',
  'IN',
  'EXISTS',
  'BETWEEN',
  'LIKE',
  'ORDER',
  'BY',
  'GROUP',
  'HAVING',
  'DISTINCT',
  'AS',
  'WITH',
  'UNION',
  'INTERSECT',
  'EXCEPT',
  'ALL',
  'INSERT',
  'UPDATE',
  'DELETE',
  'INTO',
  'VALUES',
  'SET',
  'CASE',
  'WHEN',
  'THEN',
  'ELSE',
  'END',
  'IS',
  'NULL',
  'TRUE',
  'FALSE',
  'CAST',
  'CONVERT',
  'COALESCE',
  'ASC',
  'DESC',
  'NOLOCK',
  'GO',
];

const MSSQL_FUNCTIONS = [
  'GETDATE()',
  'GETUTCDATE()',
  'SYSDATETIME()',
  'COUNT(*)',
  'COUNT(1)',
  'SUM()',
  'AVG()',
  'MIN()',
  'MAX()',
  'COALESCE()',
  'NULLIF()',
  'ISNULL()',
  'LEN()',
  'LOWER()',
  'UPPER()',
  'LTRIM()',
  'RTRIM()',
  'TRIM()',
  'SUBSTRING()',
  'CHARINDEX()',
  'REPLACE()',
  'FORMAT()',
  'CONVERT()',
  'CAST()',
  'NEWID()',
];

const MONGO_STAGE_NAMES = [
  '$match',
  '$project',
  '$group',
  '$sort',
  '$limit',
  '$skip',
  '$lookup',
  '$unwind',
  '$addFields',
  '$replaceRoot',
  '$replaceWith',
  '$count',
  '$facet',
  '$bucket',
  '$bucketAuto',
  '$sortByCount',
  '$geoNear',
  '$graphLookup',
  '$redact',
  '$sample',
];

const MONGO_OPERATORS = [
  '$eq',
  '$ne',
  '$gt',
  '$gte',
  '$lt',
  '$lte',
  '$in',
  '$nin',
  '$and',
  '$or',
  '$nor',
  '$not',
  '$exists',
  '$type',
  '$sum',
  '$avg',
  '$min',
  '$max',
  '$first',
  '$last',
  '$push',
  '$addToSet',
  '$concat',
  '$substr',
  '$toLower',
  '$toUpper',
  '$dateToString',
  '$multiply',
  '$divide',
  '$add',
  '$subtract',
  '$mod',
];

// ── Autocomplete provider ─────────────────────────────────────────────────────

export class QueryConsoleAutocomplete {
  constructor(private readonly schemaService: SchemaService) {}

  async suggest(
    ctx: RequestContext,
    _workspaceId: string,
    schemaId: string,
    queryText: string,
    cursorPosition: number,
    language: QueryLanguage,
  ): Promise<CompletionItem[]> {
    const items: CompletionItem[] = [];

    // Schema-aware suggestions (tables + columns)
    try {
      const schemaResult = await this.schemaService.getSchema(ctx, schemaId);
      if (schemaResult.isOk()) {
        const schema = schemaResult.value;
        const textBeforeCursor = queryText.slice(0, cursorPosition);

        for (const table of schema.tables) {
          items.push({
            label: table.name,
            kind: 'table',
            detail: `table in ${String(schema.name)}`,
            sortText: `1_${table.name}`,
          });

          // Suggest columns when after <table>.
          // eslint-disable-next-line security/detect-non-literal-regexp -- table.name comes from validated schema data
          const dotPattern = new RegExp(`\\b${table.name}\\.\\s*$`, 'i');
          if (dotPattern.test(textBeforeCursor)) {
            for (const col of table.columns) {
              items.push({
                label: col.name,
                kind: 'column',
                detail: String(col.type.kind),
                insertText: col.name,
                sortText: `0_${col.name}`,
              });
            }
          }
        }
      }
    } catch {
      // Schema fetch failure — return keywords only
    }

    // Language-specific keyword/function suggestions
    switch (language) {
      case 'sql_postgres':
        for (const kw of PG_KEYWORDS) {
          items.push({ label: kw, kind: 'keyword', sortText: `2_${kw}` });
        }
        for (const fn of PG_FUNCTIONS) {
          items.push({ label: fn, kind: 'function', sortText: `3_${fn}` });
        }
        break;

      case 'sql_mssql':
        for (const kw of MSSQL_KEYWORDS) {
          items.push({ label: kw, kind: 'keyword', sortText: `2_${kw}` });
        }
        for (const fn of MSSQL_FUNCTIONS) {
          items.push({ label: fn, kind: 'function', sortText: `3_${fn}` });
        }
        break;

      case 'mongo_aggregate':
        for (const stage of MONGO_STAGE_NAMES) {
          items.push({ label: stage, kind: 'keyword', sortText: `2_${stage}` });
        }
        for (const op of MONGO_OPERATORS) {
          items.push({ label: op, kind: 'operator', sortText: `3_${op}` });
        }
        break;

      case 'mongo_find':
        for (const op of MONGO_OPERATORS) {
          items.push({ label: op, kind: 'operator', sortText: `2_${op}` });
        }
        break;
    }

    return items;
  }
}
