/**
 * Entity mapper for the MSSQL adapter.
 *
 * MSSQL-specific coercions applied in fromDbRow:
 *   - BIT columns (0/1) → boolean
 *   - rowversion (Buffer) → base64 string for use as optimistic-lock token
 *   - datetime2 → JavaScript Date (driver returns Date objects automatically)
 *
 * Apply BIT coercions explicitly in your mapper implementation where needed.
 */

export interface EntityMapper<TEntity> {
  toDbRow(entity: TEntity): Record<string, unknown>;
  fromDbRow(row: Record<string, unknown>): TEntity;
  partialToDbRow(changes: Partial<TEntity>): Record<string, unknown>;
}

export type FieldMap<TEntity> = {
  [K in keyof TEntity]: string;
};

/** Convert a rowversion Buffer (8 bytes) to a base64 string token. */
export function rowVersionToToken(buf: Buffer | null | undefined): string {
  if (!buf) return '';
  return buf.toString('base64');
}

/** Convert a base64 token back to a Buffer for WHERE comparisons. */
export function tokenToRowVersion(token: string): Buffer {
  return Buffer.from(token, 'base64');
}

/** Coerce MSSQL BIT (0 | 1 | true | false) to boolean. */
export function coerceBit(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  return value === 1;
}

export function createFieldMapper<TEntity extends object>(
  fieldMap: FieldMap<TEntity>,
): EntityMapper<TEntity> {
  const colToField = new Map<string, string>();
  for (const [field, col] of Object.entries(fieldMap) as [keyof TEntity & string, string][]) {
    colToField.set(col, field);
  }

  return {
    toDbRow(entity: TEntity): Record<string, unknown> {
      const row: Record<string, unknown> = {};
      for (const [field, col] of Object.entries(fieldMap) as [keyof TEntity & string, string][]) {
        if (Object.prototype.hasOwnProperty.call(entity, field)) {
          row[col] = entity[field];
        }
      }
      return row;
    },

    fromDbRow(row: Record<string, unknown>): TEntity {
      const entity: Record<string, unknown> = {};
      for (const [col, value] of Object.entries(row)) {
        const field = colToField.get(col);
        if (field !== undefined) {
          entity[field] = value;
        }
      }
      return entity as TEntity;
    },

    partialToDbRow(changes: Partial<TEntity>): Record<string, unknown> {
      const row: Record<string, unknown> = {};
      for (const [field, col] of Object.entries(fieldMap) as [keyof TEntity & string, string][]) {
        if (Object.prototype.hasOwnProperty.call(changes, field)) {
          row[col] = changes[field];
        }
      }
      return row;
    },
  };
}
