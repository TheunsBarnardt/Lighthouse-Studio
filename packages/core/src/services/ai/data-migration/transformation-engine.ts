import type { TransformationStep, TransformationLibraryEntry } from './types.js';

export interface TransformationContext {
  sourceRow: Record<string, unknown>;
  sourceColumnName: string;
  targetColumnType: string;
}

export interface TransformationResult {
  value: unknown;
  warnings: string[];
  error?: string;
}

export class TransformationEngine {
  apply(value: unknown, steps: TransformationStep[], context: TransformationContext): TransformationResult {
    const warnings: string[] = [];
    let current = value;

    for (const step of steps) {
      try {
        current = this._applyStep(current, step, context);
      } catch (err) {
        return { value: null, warnings, error: `Step '${step.type}' failed: ${String(err)}` };
      }
    }

    return { value: current, warnings };
  }

  private _applyStep(value: unknown, step: TransformationStep, ctx: TransformationContext): unknown {
    const p = step.parameters;

    switch (step.type) {
      // String
      case 'trim': return typeof value === 'string' ? value.trim() : value;
      case 'lowercase': return typeof value === 'string' ? value.toLowerCase() : value;
      case 'uppercase': return typeof value === 'string' ? value.toUpperCase() : value;
      case 'capitalize': return typeof value === 'string' ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : value;
      case 'slugify': return typeof value === 'string' ? value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : value;
      case 'regex_replace': {
        const s = String(value ?? '');
        const pattern = new RegExp(String(p['pattern']), String(p['flags'] ?? 'g'));
        return s.replace(pattern, String(p['replacement'] ?? ''));
      }
      case 'regex_extract': {
        const s = String(value ?? '');
        const match = s.match(new RegExp(String(p['pattern'])));
        return match ? (match[Number(p['group'] ?? 0)] ?? null) : null;
      }
      case 'split': {
        const s = String(value ?? '');
        const parts = s.split(String(p['delimiter'] ?? ','));
        const idx = Number(p['index'] ?? 0);
        return parts[idx]?.trim() ?? null;
      }
      case 'join': {
        if (!Array.isArray(value)) return value;
        return value.join(String(p['delimiter'] ?? ', '));
      }
      case 'substring': return typeof value === 'string' ? value.slice(Number(p['start'] ?? 0), p['end'] !== undefined ? Number(p['end']) : undefined) : value;
      case 'pad': {
        const s = String(value ?? '');
        const len = Number(p['length'] ?? 0);
        const char = String(p['char'] ?? ' ');
        return p['side'] === 'right' ? s.padEnd(len, char) : s.padStart(len, char);
      }
      case 'mask': {
        const s = String(value ?? '');
        const keep = Number(p['keepLast'] ?? 4);
        return s.length <= keep ? s : '*'.repeat(s.length - keep) + s.slice(-keep);
      }
      // Number
      case 'parse_int': return parseInt(String(value ?? ''), Number(p['radix'] ?? 10));
      case 'parse_float': return parseFloat(String(value ?? ''));
      case 'round': return Math.round(Number(value) * Math.pow(10, Number(p['decimals'] ?? 0))) / Math.pow(10, Number(p['decimals'] ?? 0));
      case 'multiply': return Number(value) * Number(p['factor'] ?? 1);
      case 'divide': return Number(value) / Number(p['divisor'] ?? 1);
      case 'add': return Number(value) + Number(p['amount'] ?? 0);
      case 'subtract': return Number(value) - Number(p['amount'] ?? 0);
      // Date
      case 'parse_date': {
        const d = new Date(String(value ?? ''));
        return isNaN(d.getTime()) ? null : d.toISOString();
      }
      case 'format_date': {
        const d = new Date(String(value ?? ''));
        if (isNaN(d.getTime())) return null;
        const fmt = String(p['format'] ?? 'ISO');
        if (fmt === 'ISO') return d.toISOString();
        if (fmt === 'date') return d.toISOString().split('T')[0];
        return d.toISOString();
      }
      case 'add_days': {
        const d = new Date(String(value ?? ''));
        d.setDate(d.getDate() + Number(p['days'] ?? 0));
        return d.toISOString();
      }
      case 'to_unix_timestamp': return Math.floor(new Date(String(value ?? '')).getTime() / 1000);
      // Boolean
      case 'parse_bool': {
        const s = String(value ?? '').toLowerCase().trim();
        if (['true', '1', 'yes', 'on', 'y'].includes(s)) return true;
        if (['false', '0', 'no', 'off', 'n', ''].includes(s)) return false;
        return null;
      }
      // JSON
      case 'parse_json': {
        try { return JSON.parse(String(value)); } catch { return null; }
      }
      case 'format_json': return JSON.stringify(value, null, p['indent'] ? 2 : 0);
      case 'extract_path': {
        const obj = typeof value === 'string' ? JSON.parse(value) : value;
        const path = String(p['path'] ?? '').split('.');
        return path.reduce((o: unknown, k) => (o != null && typeof o === 'object' ? (o as Record<string, unknown>)[k] : null), obj);
      }
      // Conditional
      case 'if_null': return value == null ? p['default'] : value;
      case 'if_empty': return (value == null || value === '') ? p['default'] : value;
      case 'default_if': {
        const condition = p['condition'];
        return value === condition ? p['default'] : value;
      }
      // Lookup (no-op in transformation engine; resolved by executor via LookupCache)
      case 'lookup_in_table':
      case 'resolve_by_natural_key':
        return value;
      // Custom expression (no-op in pure engine; resolved by sandboxed executor)
      case 'js_expression':
        return value;
      default:
        throw new Error(`Unknown transformation type: ${step.type}`);
    }
  }

  getLibrary(): TransformationLibraryEntry[] {
    return [
      { type: 'trim', displayName: 'Trim whitespace', description: 'Remove leading and trailing whitespace', parameterSchema: {}, example: { input: '  hello  ', output: 'hello' } },
      { type: 'lowercase', displayName: 'Lowercase', description: 'Convert to lowercase', parameterSchema: {}, example: { input: 'Hello', output: 'hello' } },
      { type: 'uppercase', displayName: 'Uppercase', description: 'Convert to uppercase', parameterSchema: {}, example: { input: 'hello', output: 'HELLO' } },
      { type: 'parse_date', displayName: 'Parse date', description: 'Parse string to ISO timestamp', parameterSchema: { format: { type: 'string', description: 'Source date format hint' } }, example: { input: '2024-01-15', output: '2024-01-15T00:00:00.000Z' } },
      { type: 'parse_bool', displayName: 'Parse boolean', description: 'Convert yes/no, 1/0, true/false strings to boolean', parameterSchema: {}, example: { input: 'yes', output: true } },
      { type: 'parse_int', displayName: 'Parse integer', description: 'Convert string to integer', parameterSchema: {}, example: { input: '42', output: 42 } },
      { type: 'parse_float', displayName: 'Parse float', description: 'Convert string to float', parameterSchema: {}, example: { input: '3.14', output: 3.14 } },
      { type: 'split', displayName: 'Split and pick', description: 'Split on delimiter and pick index', parameterSchema: { delimiter: { type: 'string' }, index: { type: 'number' } }, example: { input: 'Alice Smith', output: 'Alice' } },
      { type: 'regex_replace', displayName: 'Regex replace', description: 'Replace pattern with replacement', parameterSchema: { pattern: { type: 'string' }, replacement: { type: 'string' }, flags: { type: 'string' } }, example: { input: 'hello world', output: 'hello_world' } },
      { type: 'if_null', displayName: 'Default if null', description: 'Replace null with a default value', parameterSchema: { default: {} }, example: { input: null, output: 'N/A' } },
      { type: 'mask', displayName: 'Mask sensitive data', description: 'Replace all but last N characters with asterisks', parameterSchema: { keepLast: { type: 'number' } }, example: { input: '4242424242424242', output: '************4242' } },
      { type: 'resolve_by_natural_key', displayName: 'Resolve by natural key', description: 'Look up target UUID by a natural key (email, code, etc.)', parameterSchema: { targetTable: { type: 'string' }, keyColumn: { type: 'string' } }, example: { input: 'alice@example.com', output: 'uuid-of-alice' } },
      { type: 'js_expression', displayName: 'Custom expression', description: 'Sandboxed JavaScript expression', parameterSchema: { expression: { type: 'string' } }, example: { input: 'hello world', output: 'hello_world' } },
    ];
  }
}
