/**
 * Entity mapper: translates between the platform's camelCase TypeScript entities
 * and the snake_case database row representation used by pg.
 *
 * Every entity that uses createPostgresRepository needs a mapper.
 * Use createFieldMapper for simple 1-to-1 column mappings, or implement the interface
 * manually for entities with jsonb fields, computed properties, or type coercions.
 */

export interface EntityMapper<TEntity> {
  /** Convert a platform entity to a database row (for INSERT / UPDATE). */
  toDbRow(entity: TEntity): Record<string, unknown>;
  /** Convert a database row to a platform entity (for SELECT results). */
  fromDbRow(row: Record<string, unknown>): TEntity;
  /** Convert a partial entity (changes) to a partial db row (for UPDATE SET). */
  partialToDbRow(changes: Partial<TEntity>): Record<string, unknown>;
}

/**
 * Field mapping descriptor: maps each TypeScript property name to a database column name.
 */
export type FieldMap<TEntity> = {
  [K in keyof TEntity]: string;
};

/**
 * Creates a mapper from a simple field-name mapping.
 * Handles camelCase ↔ snake_case for entities where every property maps directly to a column.
 *
 * For entities with jsonb columns, arrays, or computed fields, implement EntityMapper manually.
 */
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
