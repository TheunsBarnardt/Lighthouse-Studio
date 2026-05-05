import type { QueryLanguage } from '@platform/ports-persistence';

import { err, ok, type Result } from 'neverthrow';

// ── Classification result ─────────────────────────────────────────────────────

export interface QueryClassification {
  language: QueryLanguage;
  isReadOnly: boolean;
  containsDdl: boolean;
  statementCount: number;
  /** Table/collection names referenced; best-effort extraction. */
  affectedTables: string[];
  hasParameters: boolean;
  parameterNames: string[];
}

export interface ClassifyInput {
  query: string;
  language: QueryLanguage;
}

export class ClassifyError extends Error {
  readonly code = 'CLASSIFY_ERROR' as const;
  constructor(
    message: string,
    readonly details?: { line?: number; column?: number },
  ) {
    super(message);
    this.name = 'ClassifyError';
  }
}

// ── DDL / DML node types per dialect ─────────────────────────────────────────

const PG_DDL_NODES = new Set([
  'CreateStmt',
  'DropStmt',
  'AlterTableStmt',
  'TruncateStmt',
  'RenameStmt',
  'CommentStmt',
  'CreateIndexStmt',
  'DropIndexStmt',
  'CreateSchemaStmt',
  'CreateTableAsStmt',
  'AlterDomainStmt',
  'CreateDomainStmt',
  'CreateExtensionStmt',
  'CreateFunctionStmt',
  'AlterFunctionStmt',
  'DropStmt',
  'GrantStmt',
  'RevokeStmt',
]);

const PG_DML_NODES = new Set(['InsertStmt', 'UpdateStmt', 'DeleteStmt', 'MergeStmt']);

const MONGO_WRITE_STAGES = new Set(['$out', '$merge']);

const MONGO_READONLY_METHODS = new Set([
  'find',
  'findOne',
  'aggregate',
  'count',
  'countDocuments',
  'estimatedDocumentCount',
  'distinct',
]);

// Named parameter pattern: :paramName (SQL) or $$paramName (Mongo)
const NAMED_PARAM_REGEX = /:([a-zA-Z_][a-zA-Z0-9_]*)/g;
const MONGO_NAMED_PARAM_REGEX = /\$\$([a-zA-Z_][a-zA-Z0-9_]*)/g;

// ── SQL parser helpers ────────────────────────────────────────────────────────

function classifyPostgresSQL(query: string): Result<QueryClassification, ClassifyError> {
  // Dynamic import-time require of the WASM module
   
  let pgQuery: { parseSync: (sql: string) => { stmts: unknown[] } };
  try {
    // pg-query-emscripten exposes a synchronous parse function
    pgQuery = require('pg-query-emscripten') as typeof pgQuery;
  } catch {
    return err(new ClassifyError('pg-query-emscripten is not available'));
  }

  let parsed: { stmts: unknown[] };
  try {
    parsed = pgQuery.parseSync(query);
  } catch (cause) {
    const msg = cause instanceof Error ? cause.message : String(cause);
    return err(new ClassifyError(`Postgres SQL parse error: ${msg}`));
  }

  let containsDdl = false;
  let containsDml = false;
  const affectedTables: string[] = [];
  let statementCount = 0;

  for (const stmtWrapper of parsed.stmts) {
    statementCount++;
    const stmt = stmtWrapper as Record<string, unknown>;
    const stmtObj = stmt['stmt'] as Record<string, unknown> | undefined;
    if (!stmtObj) continue;

    const nodeType = Object.keys(stmtObj)[0];
    if (!nodeType) continue;

    if (PG_DDL_NODES.has(nodeType)) {
      containsDdl = true;
    } else if (PG_DML_NODES.has(nodeType)) {
      containsDml = true;
      const tableName = extractPostgresTableName(stmtObj, nodeType);
      if (tableName) affectedTables.push(tableName);
    } else if (nodeType === 'SelectStmt') {
      // SELECT — check for writeable CTEs
      const selectStmt = stmtObj[nodeType] as Record<string, unknown>;
      const hasCteWrite = checkSelectForWriteCtes(selectStmt);
      if (hasCteWrite) containsDml = true;
    }
  }

  const paramNames = extractNamedParams(query, NAMED_PARAM_REGEX);

  return ok({
    language: 'sql_postgres',
    isReadOnly: !containsDdl && !containsDml,
    containsDdl,
    statementCount,
    affectedTables,
    hasParameters: paramNames.length > 0,
    parameterNames: paramNames,
  });
}

function extractPostgresTableName(
  stmtObj: Record<string, unknown>,
  nodeType: string,
): string | null {
  try {
    const stmt = stmtObj[nodeType] as Record<string, unknown>;
    const relation = stmt['relation'] as Record<string, unknown> | undefined;
    if (relation) {
      return (relation['relname'] as string) ?? null;
    }
  } catch {
    // best-effort
  }
  return null;
}

function checkSelectForWriteCtes(selectStmt: Record<string, unknown>): boolean {
  const withClause = selectStmt['withClause'] as Record<string, unknown> | undefined;
  if (!withClause) return false;
  const ctes = withClause['ctes'] as Array<Record<string, unknown>> | undefined;
  if (!ctes) return false;
  for (const cte of ctes) {
    const inner = cte['CommonTableExpr'] as Record<string, unknown> | undefined;
    if (!inner) continue;
    const cteQuery = inner['ctequery'] as Record<string, unknown> | undefined;
    if (!cteQuery) continue;
    const nodeType = Object.keys(cteQuery)[0];
    if (nodeType && PG_DML_NODES.has(nodeType)) return true;
  }
  return false;
}

function classifyMssqlSQL(query: string): Result<QueryClassification, ClassifyError> {
   
  let Parser: new (opts?: { database?: string }) => { astify: (sql: string) => unknown };
  try {
    const mod = require('node-sql-parser') as { Parser: typeof Parser };
    Parser = mod.Parser;
  } catch {
    return err(new ClassifyError('node-sql-parser is not available'));
  }

  let ast: unknown;
  try {
    const parser = new Parser({ database: 'TransactSQL' });
    ast = parser.astify(query);
  } catch (cause) {
    const msg = cause instanceof Error ? cause.message : String(cause);
    return err(new ClassifyError(`MSSQL T-SQL parse error: ${msg}`));
  }

  const stmts = Array.isArray(ast) ? ast : [ast];
  let containsDdl = false;
  let containsDml = false;
  const affectedTables: string[] = [];
  let statementCount = 0;

  for (const stmt of stmts) {
    if (!stmt || typeof stmt !== 'object') continue;
    statementCount++;
    const s = stmt as Record<string, unknown>;
    const type = (s['type'] as string | undefined)?.toLowerCase() ?? '';

    if (['create', 'alter', 'drop', 'truncate', 'rename', 'comment'].includes(type)) {
      containsDdl = true;
    } else if (['insert', 'update', 'delete', 'merge', 'replace'].includes(type)) {
      containsDml = true;
      const tblName = extractMssqlTableName(s, type);
      if (tblName) affectedTables.push(tblName);
    }
  }

  const paramNames = extractNamedParams(query, NAMED_PARAM_REGEX);

  return ok({
    language: 'sql_mssql',
    isReadOnly: !containsDdl && !containsDml,
    containsDdl,
    statementCount,
    affectedTables,
    hasParameters: paramNames.length > 0,
    parameterNames: paramNames,
  });
}

function extractMssqlTableName(stmt: Record<string, unknown>, type: string): string | null {
  try {
    if (type === 'insert') {
      const tbl = stmt['table'] as Array<{ table: string }> | undefined;
      return tbl?.[0]?.table ?? null;
    }
    if (type === 'update') {
      const tbl = stmt['table'] as Array<{ table: string }> | undefined;
      return tbl?.[0]?.table ?? null;
    }
    if (type === 'delete') {
      const tbl = stmt['table'] as Array<{ table: string }> | undefined;
      return tbl?.[0]?.table ?? null;
    }
  } catch {
    // best-effort
  }
  return null;
}

// ── Mongo classifier ──────────────────────────────────────────────────────────

function classifyMongo(
  query: string,
  language: 'mongo_aggregate' | 'mongo_find',
): Result<QueryClassification, ClassifyError> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(query);
  } catch (cause) {
    const msg = cause instanceof Error ? cause.message : String(cause);
    return err(new ClassifyError(`MongoDB query parse error: ${msg}`));
  }

  let containsDdl = false;
  let containsDml = false;
  const affectedTables: string[] = [];

  if (language === 'mongo_aggregate') {
    // Expected: array of pipeline stages
    const stages = Array.isArray(parsed) ? parsed : [];
    for (const stage of stages) {
      if (stage && typeof stage === 'object') {
        const stageName = Object.keys(stage as Record<string, unknown>)[0];
        if (stageName && MONGO_WRITE_STAGES.has(stageName)) {
          containsDml = true;
          const target = (stage as Record<string, unknown>)[stageName];
          if (typeof target === 'string') affectedTables.push(target);
        }
      }
    }
  } else {
    // mongo_find — find / findOne / etc. are always read-only
    // But validate the method if the query uses db.<coll>.<method>() style
    const methodMatch = /\.\s*([a-zA-Z]+)\s*\(/.exec(query);
    if (methodMatch) {
      const method = methodMatch[1] ?? '';
      if (!MONGO_READONLY_METHODS.has(method)) {
        containsDml = true;
      }
    }
  }

  const paramNames = extractNamedParams(query, MONGO_NAMED_PARAM_REGEX);

  return ok({
    language,
    isReadOnly: !containsDdl && !containsDml,
    containsDdl,
    statementCount: 1,
    affectedTables,
    hasParameters: paramNames.length > 0,
    parameterNames: paramNames,
  });
}

// ── Named parameter extraction ────────────────────────────────────────────────

function extractNamedParams(query: string, regex: RegExp): string[] {
  const names = new Set<string>();
  let match: RegExpExecArray | null;
  const re = new RegExp(regex.source, regex.flags);
  while ((match = re.exec(query)) !== null) {
    if (match[1]) names.add(match[1]);
  }
  return [...names];
}

// ── Public classifier ─────────────────────────────────────────────────────────

export interface QueryClassifierPort {
  classify(input: ClassifyInput): Result<QueryClassification, ClassifyError>;
}

export class QueryClassifierImpl implements QueryClassifierPort {
  classify(input: ClassifyInput): Result<QueryClassification, ClassifyError> {
    const { query, language } = input;

    if (!query.trim()) {
      return err(new ClassifyError('Query text is empty'));
    }

    switch (language) {
      case 'sql_postgres':
        return classifyPostgresSQL(query);
      case 'sql_mssql':
        return classifyMssqlSQL(query);
      case 'mongo_aggregate':
        return classifyMongo(query, 'mongo_aggregate');
      case 'mongo_find':
        return classifyMongo(query, 'mongo_find');
    }
  }
}
