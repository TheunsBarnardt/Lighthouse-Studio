import type { StaticAnalysisReport, StaticViolation } from './types.js';

const FORBIDDEN_IMPORTS = [
  'child_process', 'cluster', 'worker_threads', 'vm', 'repl',
  'fs', 'fs/promises', 'node:fs', 'node:fs/promises',
  'net', 'dgram', 'tls', 'node:net', 'node:dgram',
];

const FORBIDDEN_PATTERNS = [
  { pattern: /\beval\s*\(/, type: 'forbidden_call', message: 'eval() is forbidden in sandbox' },
  { pattern: /new\s+Function\s*\(/, type: 'forbidden_call', message: 'new Function() is forbidden in sandbox' },
  { pattern: /process\.exit/, type: 'forbidden_call', message: 'process.exit() is forbidden; throw an error instead' },
  { pattern: /process\.env\b/, type: 'unsafe_pattern', message: 'Use ctx.secrets for credentials; process.env is not available in sandbox' },
  { pattern: /require\s*\(/, type: 'unsafe_pattern', message: 'CommonJS require() is not allowed; use ES module imports' },
  { pattern: /globalThis\s*\[/, type: 'sandbox_escape_attempt', message: 'Dynamic globalThis access is a sandbox escape vector' },
  { pattern: /__proto__/, type: 'sandbox_escape_attempt', message: '__proto__ manipulation is a sandbox escape vector' },
] as const;

const ALLOWED_IMPORT_PREFIXES = [
  '@platform/',
  'zod',
  'lodash',
  'date-fns',
  'node:crypto',
  'node:url',
  'node:path',
  'node:buffer',
  'node:stream',
];

export class StaticAnalyzer {
  analyze(source: string): StaticAnalysisReport {
    const violations: StaticViolation[] = [];
    const warnings: string[] = [];
    const lines = source.split('\n');

    lines.forEach((line, i) => {
      const lineNo = i + 1;

      // Forbidden imports
      const importMatch = line.match(/^\s*import\s+.*?\s+from\s+['"]([^'"]+)['"]/);
      if (importMatch) {
        const mod = importMatch[1];
        const isForbidden = FORBIDDEN_IMPORTS.some(f => mod === f || mod.startsWith(f + '/'));
        const isAllowed = ALLOWED_IMPORT_PREFIXES.some(p => mod.startsWith(p));
        if (isForbidden) {
          violations.push({
            type: 'forbidden_import',
            line: lineNo,
            column: 0,
            message: `Import of '${mod}' is forbidden in sandbox`,
            severity: 'error',
          });
        } else if (!isAllowed && !mod.startsWith('./') && !mod.startsWith('../')) {
          warnings.push(`Line ${lineNo}: Import '${mod}' is not in the approved list; ensure it is available in the runtime`);
        }
      }

      // Forbidden patterns
      for (const { pattern, type, message } of FORBIDDEN_PATTERNS) {
        if (pattern.test(line)) {
          violations.push({
            type: type as StaticViolation['type'],
            line: lineNo,
            column: 0,
            message,
            severity: type === 'sandbox_escape_attempt' ? 'error' : 'error',
          });
        }
      }
    });

    return {
      passed: violations.filter(v => v.severity === 'error').length === 0,
      violations,
      warnings,
      analyzedAt: new Date(),
    };
  }

  checkPermissionDeclarations(source: string, declaredPermissions: string[]): { accurate: boolean; missing: string[] } {
    const missing: string[] = [];
    const sdkWritePattern = /sdk\.data\([^)]+\)\.(update|create|delete|insert)/g;
    const sdkReadPattern = /sdk\.data\([^)]+\)\.(list|get|where|findOne|one)/g;

    if (sdkWritePattern.test(source) && !declaredPermissions.some(p => p.includes('update') || p.includes('create') || p.includes('delete'))) {
      missing.push('data_table.write');
    }
    if (sdkReadPattern.test(source) && !declaredPermissions.some(p => p.includes('read'))) {
      missing.push('data_table.read');
    }

    return { accurate: missing.length === 0, missing };
  }
}
