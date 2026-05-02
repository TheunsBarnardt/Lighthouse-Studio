/**
 * Generates docs/contracts/persistence-conformance-report.md
 * from the static capability declarations of each adapter.
 *
 * Run: pnpm tsx scripts/generate-capability-matrix.mts
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const FEATURES: string[] = [
  'schemas',
  'foreign_keys',
  'check_constraints',
  'computed_columns',
  'json_columns',
  'array_columns',
  'partial_indexes',
  'unique_indexes',
  'spatial_indexes',
  'transactions',
  'change_streams',
];

interface AdapterCapabilities {
  name: string;
  features: Partial<Record<string, boolean>>;
  notes: string[];
}

// Static declarations — kept in sync with each adapter's supports() method
const ADAPTERS: AdapterCapabilities[] = [
  {
    name: 'PostgreSQL',
    features: {
      schemas: true,
      foreign_keys: true,
      check_constraints: true,
      computed_columns: false,
      json_columns: true,
      array_columns: true,
      partial_indexes: true,
      unique_indexes: true,
      spatial_indexes: false,
      transactions: true,
      change_streams: true,
    },
    notes: [
      'Array columns via native PostgreSQL array types',
      'JSON stored as jsonb with GIN indexes',
      'Change streams via logical replication (pgoutput plugin)',
      'Partial indexes are natively supported',
    ],
  },
  {
    name: 'MSSQL',
    features: {
      schemas: true,
      foreign_keys: true,
      check_constraints: true,
      computed_columns: false,
      json_columns: true,
      array_columns: false,
      partial_indexes: false,
      unique_indexes: true,
      spatial_indexes: false,
      transactions: true,
      change_streams: true,
    },
    notes: [
      'No native array type — schema DDL adapter rejects array column definitions',
      'JSON stored in NVARCHAR(MAX) with ISJSON() CHECK constraint',
      'Change streams via SQL Server CDC (Change Data Capture) — requires Enterprise/Developer edition',
      'CDC polling introduces latency (default 5s interval)',
      'Before-images available with CDC "all update old" capture mode',
    ],
  },
  {
    name: 'MongoDB',
    features: {
      schemas: false,
      foreign_keys: false,
      check_constraints: false,
      computed_columns: false,
      json_columns: true,
      array_columns: true,
      partial_indexes: false,
      unique_indexes: true,
      spatial_indexes: false,
      transactions: true,
      change_streams: true,
    },
    notes: [
      'No relational foreign keys — application-layer referential integrity only',
      'JSON Schema validators used instead of check constraints',
      'Transactions require replica set topology (even single-node)',
      'Change streams via MongoDB native watch() API — requires replica set',
      'Before-images require MongoDB 6.0+ with changeStreamPreAndPostImages enabled',
      'Multi-document transactions have a 60-second default timeout',
    ],
  },
];

function cell(supported: boolean | undefined): string {
  if (supported === undefined) return '❓';
  return supported ? '✅' : '❌';
}

function formatFeatureName(f: string): string {
  return f.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
}

async function main(): Promise<void> {
  const now = new Date().toISOString();
  const lines: string[] = [
    '# Persistence Adapter Conformance Report',
    '',
    `_Auto-generated on ${now}. Do not edit by hand._`,
    '',
    '## Capability Matrix',
    '',
    `| Feature | ${ADAPTERS.map((a) => a.name).join(' | ')} |`,
    `| ------- | ${ADAPTERS.map(() => '---').join(' | ')} |`,
  ];

  for (const feature of FEATURES) {
    const cells = ADAPTERS.map((a) => cell(a.features[feature])).join(' | ');
    lines.push(`| ${formatFeatureName(feature)} | ${cells} |`);
  }

  lines.push('');
  lines.push('## Adapter Notes');
  lines.push('');

  for (const adapter of ADAPTERS) {
    lines.push(`### ${adapter.name}`);
    lines.push('');
    for (const note of adapter.notes) {
      lines.push(`- ${note}`);
    }
    lines.push('');
  }

  lines.push('## Known Divergences');
  lines.push('');
  lines.push('| Behaviour | PostgreSQL | MSSQL | MongoDB |');
  lines.push('| --------- | ---------- | ----- | ------- |');
  lines.push(
    '| LIKE case sensitivity | Case-sensitive (LIKE) / insensitive (ILIKE) | Case-insensitive (depends on collation) | Regex `i` flag |',
  );
  lines.push(
    '| Null handling in IN | NULL never matches | NULL never matches | null matches null |',
  );
  lines.push(
    '| Timestamp precision | Microsecond (timestamptz) | 100ns (datetime2(7)) | Millisecond (BSON Date) |',
  );
  lines.push(
    '| Optimistic lock column | `_version` INTEGER | `_version` INTEGER | `_version` INTEGER |',
  );
  lines.push(
    '| JSON query operators | jsonb operators (`@>`, `?`) | JSON_VALUE / JSON_QUERY | MongoDB query operators |',
  );
  lines.push('');
  lines.push('## Conformance Test Results');
  lines.push('');
  lines.push('See CI artifacts for the latest per-adapter test run results.');
  lines.push('');

  const outDir = path.join(ROOT, 'docs', 'contracts');
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, 'persistence-conformance-report.md');
  await fs.writeFile(outPath, lines.join('\n'), 'utf8');
  process.stdout.write(`Generated: ${outPath}\n`);
}

await main();
