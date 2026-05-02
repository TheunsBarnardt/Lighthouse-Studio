import type { Document } from 'mongodb';

/**
 * Entity mapper for the MongoDB adapter.
 *
 * MongoDB stores documents with snake_case fields (platform convention).
 * The _id field is not used — platform entities use a string 'id' field.
 * When reading from MongoDB, _id is stripped (it's the Mongo internal id, not our id).
 *
 * Platform entities have an 'id' field. The adapter stores it as '_id' in MongoDB
 * for efficient primary-key lookups, and ALSO as 'id' for cross-database query
 * compatibility. The mapper handles this dual-storage transparently.
 */
export interface EntityMapper<TEntity> {
  toDocument(entity: TEntity): Document;
  fromDocument(doc: Document): TEntity;
  partialToDocument(changes: Partial<TEntity>): Document;
}

export type FieldMap<TEntity> = {
  [K in keyof TEntity]: string;
};

export function createFieldMapper<TEntity extends { id: string }>(
  fieldMap: FieldMap<TEntity>,
): EntityMapper<TEntity> {
  const docToField = new Map<string, string>();
  for (const [field, docKey] of Object.entries(fieldMap) as [keyof TEntity & string, string][]) {
    docToField.set(docKey, field);
  }

  return {
    toDocument(entity: TEntity): Document {
      const doc: Document = {};
      for (const [field, docKey] of Object.entries(fieldMap) as [
        keyof TEntity & string,
        string,
      ][]) {
        if (Object.prototype.hasOwnProperty.call(entity, field)) {
          doc[docKey] = entity[field];
        }
      }
      // Store id as _id for primary-key lookup efficiency
      doc['_id'] = entity.id;
      return doc;
    },

    fromDocument(doc: Document): TEntity {
      const entity: Record<string, unknown> = {};
      for (const [docKey, value] of Object.entries(doc)) {
        if (docKey === '_id') continue; // mapped via 'id' field
        const field = docToField.get(docKey);
        if (field !== undefined) {
          entity[field] = value;
        }
      }
      return entity as TEntity;
    },

    partialToDocument(changes: Partial<TEntity>): Document {
      const doc: Document = {};
      for (const [field, docKey] of Object.entries(fieldMap) as [
        keyof TEntity & string,
        string,
      ][]) {
        if (Object.prototype.hasOwnProperty.call(changes, field)) {
          doc[docKey] = changes[field];
        }
      }
      return doc;
    },
  };
}
