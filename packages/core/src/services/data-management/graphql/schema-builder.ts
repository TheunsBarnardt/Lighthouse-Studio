import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLUnionType,
  GraphQLEnumType,
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLID,
  GraphQLList,
  GraphQLNonNull,
  type GraphQLFieldConfig,
  type GraphQLOutputType,
  type GraphQLScalarType,
  type GraphQLInputType,
  type GraphQLNamedType,
} from 'graphql';

import type { CustomerSchema, CustomerTableDefinition, NormalizedType } from '../schema-model.js';
import type { GraphQLContext } from './request-handler.js';

import {
  listResolver,
  getOneResolver,
  countResolver,
  createResolver,
  updateResolver,
  archiveResolver,
  restoreResolver,
  hardDeleteResolver,
  foreignKeyToOneResolver,
  foreignKeyToManyResolver,
} from './resolvers.js';

// ── Naming helpers ─────────────────────────────────────────────────────────────

/** `user_profile` → `userProfile` */
function toCamelCase(name: string): string {
  return name.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

/** `user_profile` → `UserProfile` */
function toPascalCase(name: string): string {
  const c = toCamelCase(name);
  return c.charAt(0).toUpperCase() + c.slice(1);
}

/**
 * Best-effort English singularization for typical database table names.
 * `users` → `user`, `categories` → `category`, `addresses` → `address`.
 */
function toSingular(name: string): string {
  if (name.endsWith('ies')) return name.slice(0, -3) + 'y';
  if (name.endsWith('sses')) return name.slice(0, -2); // addresses → address
  if (name.endsWith('s') && !name.endsWith('ss') && !name.endsWith('us') && !name.endsWith('is')) {
    return name.slice(0, -1);
  }
  return name;
}

/** Singular PascalCase for GraphQL type names: `users` → `User` */
function singularTypeName(tableName: string): string {
  return toPascalCase(toSingular(tableName));
}

/** Singular camelCase for GraphQL field names: `users` → `user` */
function singularFieldName(tableName: string): string {
  return toCamelCase(toSingular(tableName));
}

// ── Column type → GraphQL scalar ───────────────────────────────────────────────

function columnKindToScalar(kind: NormalizedType['kind']): GraphQLScalarType {
  switch (kind) {
    case 'integer':
    case 'bigint':
      return GraphQLInt;
    case 'decimal':
      return GraphQLFloat;
    case 'boolean':
      return GraphQLBoolean;
    case 'uuid':
      return GraphQLID;
    case 'array':
    case 'json':
    case 'binary':
    case 'date':
    case 'timestamp':
    case 'timestamp_tz':
    case 'string':
    case 'text':
    default:
      return GraphQLString;
  }
}

function columnKindToFilterInput(
  kind: NormalizedType['kind'],
  filterTypes: FilterScalarTypes,
): GraphQLInputObjectType {
  switch (kind) {
    case 'integer':
    case 'bigint':
      return filterTypes.int;
    case 'decimal':
      return filterTypes.float;
    case 'boolean':
      return filterTypes.boolean;
    case 'uuid':
      return filterTypes.id;
    default:
      return filterTypes.string;
  }
}

// ── Shared scalar filter input types ──────────────────────────────────────────

interface FilterScalarTypes {
  string: GraphQLInputObjectType;
  int: GraphQLInputObjectType;
  float: GraphQLInputObjectType;
  boolean: GraphQLInputObjectType;
  id: GraphQLInputObjectType;
}

function buildFilterScalarTypes(): FilterScalarTypes {
  const string = new GraphQLInputObjectType({
    name: 'StringFilterInput',
    fields: {
      _eq: { type: GraphQLString },
      _neq: { type: GraphQLString },
      _in: { type: new GraphQLList(new GraphQLNonNull(GraphQLString)) },
      _nin: { type: new GraphQLList(new GraphQLNonNull(GraphQLString)) },
      _contains: { type: GraphQLString },
      _icontains: { type: GraphQLString },
      _starts_with: { type: GraphQLString },
      _ends_with: { type: GraphQLString },
      _is_null: { type: GraphQLBoolean },
    },
  });

  const int = new GraphQLInputObjectType({
    name: 'IntFilterInput',
    fields: {
      _eq: { type: GraphQLInt },
      _neq: { type: GraphQLInt },
      _lt: { type: GraphQLInt },
      _lte: { type: GraphQLInt },
      _gt: { type: GraphQLInt },
      _gte: { type: GraphQLInt },
      _in: { type: new GraphQLList(new GraphQLNonNull(GraphQLInt)) },
      _nin: { type: new GraphQLList(new GraphQLNonNull(GraphQLInt)) },
      _is_null: { type: GraphQLBoolean },
    },
  });

  const float = new GraphQLInputObjectType({
    name: 'FloatFilterInput',
    fields: {
      _eq: { type: GraphQLFloat },
      _neq: { type: GraphQLFloat },
      _lt: { type: GraphQLFloat },
      _lte: { type: GraphQLFloat },
      _gt: { type: GraphQLFloat },
      _gte: { type: GraphQLFloat },
      _is_null: { type: GraphQLBoolean },
    },
  });

  const boolean = new GraphQLInputObjectType({
    name: 'BooleanFilterInput',
    fields: {
      _eq: { type: GraphQLBoolean },
      _neq: { type: GraphQLBoolean },
      _is_null: { type: GraphQLBoolean },
    },
  });

  const id = new GraphQLInputObjectType({
    name: 'IDFilterInput',
    fields: {
      _eq: { type: GraphQLID },
      _neq: { type: GraphQLID },
      _in: { type: new GraphQLList(new GraphQLNonNull(GraphQLID)) },
      _nin: { type: new GraphQLList(new GraphQLNonNull(GraphQLID)) },
      _is_null: { type: GraphQLBoolean },
    },
  });

  return { string, int, float, boolean, id };
}

// ── Shared output types ────────────────────────────────────────────────────────

const PageInfoType = new GraphQLObjectType({
  name: 'PageInfo',
  fields: {
    hasNextPage: { type: new GraphQLNonNull(GraphQLBoolean) },
    hasPreviousPage: { type: new GraphQLNonNull(GraphQLBoolean) },
    startCursor: { type: GraphQLString },
    endCursor: { type: GraphQLString },
  },
});

const FieldErrorType = new GraphQLObjectType({
  name: 'FieldError',
  fields: {
    field: { type: new GraphQLNonNull(GraphQLString) },
    code: { type: new GraphQLNonNull(GraphQLString) },
    message: { type: new GraphQLNonNull(GraphQLString) },
  },
});

const ValidationErrorType = new GraphQLObjectType({
  name: 'ValidationError',
  fields: {
    errors: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(FieldErrorType))),
    },
  },
});

const ConflictErrorType = new GraphQLObjectType({
  name: 'ConflictError',
  fields: {
    message: { type: new GraphQLNonNull(GraphQLString) },
    conflictingField: { type: GraphQLString },
  },
});

const AuthorizationErrorType = new GraphQLObjectType({
  name: 'AuthorizationError',
  fields: {
    message: { type: new GraphQLNonNull(GraphQLString) },
    requiredPermission: { type: new GraphQLNonNull(GraphQLString) },
  },
});

const DeleteSuccessType = new GraphQLObjectType({
  name: 'DeleteSuccess',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
  },
});

const SortDirectionEnum = new GraphQLEnumType({
  name: 'SortDirection',
  values: {
    ASC: { value: 'ASC' },
    DESC: { value: 'DESC' },
  },
});

// ── Per-table type builders ────────────────────────────────────────────────────

/** Build the object type for one customer table. */
function buildTableObjectType(
  table: CustomerTableDefinition,
  tableTypes: Map<string, GraphQLObjectType>,
  schema: CustomerSchema,
): GraphQLObjectType {
  const typeName = singularTypeName(table.name);

  return new GraphQLObjectType({
    name: typeName,
    description: table.description,
    fields: () => {
      const fields: Record<
        string,
        GraphQLFieldConfig<Record<string, unknown>, GraphQLContext>
      > = {};

      // Column fields
      for (const col of table.columns) {
        const scalar = columnKindToScalar(col.type.kind);
        const gqlType: GraphQLOutputType = col.nullable ? scalar : new GraphQLNonNull(scalar);
        fields[toCamelCase(col.name)] = {
          type: gqlType,
          description: col.description,
          resolve: (parent) => parent[col.name],
        };
      }

      // To-one FK relationships (this table has the FK column → referenced table)
      for (const fk of table.foreignKeys) {
        const refTable = schema.tables.find((t) => t.id === fk.referencedTableId);
        if (!refTable) continue;
        const refType = tableTypes.get(refTable.name);
        if (!refType) continue;

        const fkCol = table.columns.find((c) => fk.columns.includes(c.id));
        if (!fkCol) continue;

        const fieldName = toCamelCase(refTable.name);
        fields[fieldName] = {
          type: refType,
          description: fk.advisory
            ? `Advisory FK to ${refTable.name} (not database-enforced on MongoDB).`
            : undefined,
          resolve: foreignKeyToOneResolver(refTable, fkCol.name),
        };
      }

      // To-many relationships (other tables that have FK pointing here)
      for (const otherTable of schema.tables) {
        if (otherTable.id === table.id) continue;
        for (const fk of otherTable.foreignKeys) {
          if (fk.referencedTableId !== table.id) continue;
          const refType = tableTypes.get(otherTable.name);
          if (!refType) continue;

          const connectionTypeName = `${singularTypeName(otherTable.name)}Connection`;
          // connectionType is built later, so we use a lazy lookup
          const fieldName = `${toCamelCase(otherTable.name)}List`;
          fields[fieldName] = {
            type: refType, // overridden below when connection types are built
            args: {
              first: { type: GraphQLInt },
              after: { type: GraphQLString },
            },
            resolve: foreignKeyToManyResolver(otherTable, fk),
            extensions: { _connectionTypeName: connectionTypeName },
          };
        }
      }

      return fields;
    },
  });
}

/** Build the filter input type for one customer table. */
function buildTableFilterInput(
  table: CustomerTableDefinition,
  filterTypes: FilterScalarTypes,
): GraphQLInputObjectType {
  const typeName = `${singularTypeName(table.name)}FilterInput`;

  // Use a ref so the self-referential fields (_and, _or, _not) work
  let selfRef: GraphQLInputObjectType;

  const filterInput = new GraphQLInputObjectType({
    name: typeName,
    fields: () => {
      const fields: Record<string, { type: GraphQLInputType }> = {};

      for (const col of table.columns) {
        fields[toCamelCase(col.name)] = {
          type: columnKindToFilterInput(col.type.kind, filterTypes),
        };
      }

      fields['_and'] = {
        type: new GraphQLList(new GraphQLNonNull(selfRef)),
      };
      fields['_or'] = {
        type: new GraphQLList(new GraphQLNonNull(selfRef)),
      };
      fields['_not'] = { type: selfRef };

      return fields;
    },
  });

  selfRef = filterInput;
  return filterInput;
}

/** Build the sort input type for one customer table. */
function buildTableSortInput(table: CustomerTableDefinition): GraphQLInputObjectType {
  return new GraphQLInputObjectType({
    name: `${singularTypeName(table.name)}SortInput`,
    fields: () => {
      const fields: Record<string, { type: GraphQLInputType }> = {};
      for (const col of table.columns) {
        fields[toCamelCase(col.name)] = { type: SortDirectionEnum };
      }
      return fields;
    },
  });
}

/** Build create/update input types for one customer table. */
function buildMutationInputTypes(
  table: CustomerTableDefinition,
  pkColIds: Set<string>,
): { createInput: GraphQLInputObjectType; updateInput: GraphQLInputObjectType } {
  const SYSTEM_COLUMN_NAMES = new Set([
    'created_at',
    'updated_at',
    'archived_at',
    'archived',
    'version',
  ]);

  const userColumns = table.columns.filter(
    (c) => !pkColIds.has(c.id) && !SYSTEM_COLUMN_NAMES.has(c.name) && !c.generated,
  );

  const createFields: Record<string, { type: GraphQLInputType }> = {};
  const updateFields: Record<string, { type: GraphQLInputType }> = {};

  for (const col of userColumns) {
    const scalar = columnKindToScalar(col.type.kind);
    // Required in create if non-nullable and no default
    const hasDefault = col.defaultValue !== undefined;
    const required = !col.nullable && !hasDefault;
    createFields[toCamelCase(col.name)] = {
      type: required ? new GraphQLNonNull(scalar) : scalar,
    };
    // Always optional in update (PATCH semantics)
    updateFields[toCamelCase(col.name)] = { type: scalar };
  }

  return {
    createInput: new GraphQLInputObjectType({
      name: `Create${singularTypeName(table.name)}Input`,
      fields: () => createFields,
    }),
    updateInput: new GraphQLInputObjectType({
      name: `Update${singularTypeName(table.name)}Input`,
      fields: () => updateFields,
    }),
  };
}

/** Build the Relay Connection + Edge types for one customer table. */
function buildConnectionTypes(tableType: GraphQLObjectType): {
  connectionType: GraphQLObjectType;
  edgeType: GraphQLObjectType;
} {
  const typeName = tableType.name;

  const edgeType = new GraphQLObjectType({
    name: `${typeName}Edge`,
    fields: {
      node: { type: new GraphQLNonNull(tableType) },
      cursor: { type: new GraphQLNonNull(GraphQLString) },
    },
  });

  const connectionType = new GraphQLObjectType({
    name: `${typeName}Connection`,
    fields: {
      edges: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(edgeType))),
      },
      pageInfo: { type: new GraphQLNonNull(PageInfoType) },
      totalCount: { type: GraphQLInt },
    },
  });

  return { connectionType, edgeType };
}

/** Build mutation result union types for a table. */
function buildMutationResultTypes(
  tableType: GraphQLObjectType,
  verb: 'Create' | 'Update',
): { successType: GraphQLObjectType; resultType: GraphQLUnionType } {
  // tableType.name is already singular PascalCase (e.g. "User"); lowercase first char for the field
  const entityField = tableType.name.charAt(0).toLowerCase() + tableType.name.slice(1);

  const successType = new GraphQLObjectType({
    name: `${verb}${tableType.name}Success`,
    fields: {
      [entityField]: { type: new GraphQLNonNull(tableType) },
    },
  });

  const resultType = new GraphQLUnionType({
    name: `${verb}${tableType.name}Result`,
    types: [successType, ValidationErrorType, ConflictErrorType, AuthorizationErrorType],
    resolveType: (value: { __typename: string }) => {
      switch (value.__typename) {
        case 'ValidationError':
          return 'ValidationError';
        case 'ConflictError':
          return 'ConflictError';
        case 'AuthorizationError':
          return 'AuthorizationError';
        default:
          return `${verb}${tableType.name}Success`;
      }
    },
  });

  return { successType, resultType };
}

// ── Depth & complexity validation rule ────────────────────────────────────────

import type { ValidationRule } from 'graphql';

import { GraphQLError } from 'graphql';

export function createDepthLimitRule(maxDepth: number): ValidationRule {
  return (context) => ({
    Field(node, _key, _parent, path) {
      // Each 'selectionSet' key in the path represents one level of nesting
      const depth = path.filter((p) => p === 'selectionSet').length;
      if (depth > maxDepth) {
        context.reportError(
          new GraphQLError(
            `Query depth ${String(depth)} exceeds maximum allowed depth of ${String(maxDepth)}.`,
            { nodes: [node] },
          ),
        );
      }
    },
  });
}

// ── Schema builder ─────────────────────────────────────────────────────────────

export interface SchemaBuilderConfig {
  maxQueryDepth?: number;
  maxQueryComplexity?: number;
}

interface BuiltSchema {
  schema: GraphQLSchema;
  tableTypes: Map<string, GraphQLObjectType>;
  filterInputs: Map<string, GraphQLInputObjectType>;
  sortInputs: Map<string, GraphQLInputObjectType>;
  connectionTypes: Map<string, GraphQLObjectType>;
}

/**
 * Builds and caches GraphQL schemas from customer-defined schemas.
 * Pure — no I/O. One instance per application; schemas are cached per (schemaId, version).
 */
export class GraphQLSchemaBuilder {
  private readonly cache = new Map<string, BuiltSchema>();

  getOrBuild(customerSchema: CustomerSchema): BuiltSchema {
    const key = `${customerSchema.id}:v${String(customerSchema.version)}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const built = this._build(customerSchema);
    this.cache.set(key, built);
    return built;
  }

  invalidate(schemaId: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${schemaId}:`)) {
        this.cache.delete(key);
      }
    }
  }

  private _build(customerSchema: CustomerSchema): BuiltSchema {
    const filterTypes = buildFilterScalarTypes();

    // Phase 1: Build object types for all tables (without FK fields, which are circular)
    const tableTypes = new Map<string, GraphQLObjectType>();
    for (const table of customerSchema.tables) {
      tableTypes.set(table.name, buildTableObjectType(table, tableTypes, customerSchema));
    }

    // Phase 2: Build filter/sort inputs
    const filterInputs = new Map<string, GraphQLInputObjectType>();
    const sortInputs = new Map<string, GraphQLInputObjectType>();
    for (const table of customerSchema.tables) {
      filterInputs.set(table.name, buildTableFilterInput(table, filterTypes));
      sortInputs.set(table.name, buildTableSortInput(table));
    }

    // Phase 3: Build connection types
    const connectionTypes = new Map<string, GraphQLObjectType>();
    const edgeTypes = new Map<string, GraphQLObjectType>();
    for (const table of customerSchema.tables) {
      const tableType = tableTypes.get(table.name) as GraphQLObjectType;
      const { connectionType, edgeType } = buildConnectionTypes(tableType);
      connectionTypes.set(table.name, connectionType);
      edgeTypes.set(table.name, edgeType);
    }

    // Phase 4: Build mutation input types and result union types
    const createInputTypes = new Map<string, GraphQLInputObjectType>();
    const updateInputTypes = new Map<string, GraphQLInputObjectType>();
    const createResultTypes = new Map<string, GraphQLUnionType>();
    const updateResultTypes = new Map<string, GraphQLUnionType>();

    for (const table of customerSchema.tables) {
      const tableType = tableTypes.get(table.name) as GraphQLObjectType;

      // Determine PK column IDs
      const pk = table.primaryKey;
      const pkColIds = new Set<string>(pk.kind === 'composite' ? pk.columnIds : [pk.columnId]);

      const { createInput, updateInput } = buildMutationInputTypes(table, pkColIds);
      createInputTypes.set(table.name, createInput);
      updateInputTypes.set(table.name, updateInput);

      const { resultType: createResult } = buildMutationResultTypes(tableType, 'Create');
      const { resultType: updateResult } = buildMutationResultTypes(tableType, 'Update');
      createResultTypes.set(table.name, createResult);
      updateResultTypes.set(table.name, updateResult);
    }

    // Phase 5: Build Query root
    const queryFields: Record<string, GraphQLFieldConfig<undefined, GraphQLContext>> = {};

    for (const table of customerSchema.tables) {
      const tableType = tableTypes.get(table.name) as GraphQLObjectType;
      const connectionType = connectionTypes.get(table.name) as GraphQLObjectType;
      const filterInput = filterInputs.get(table.name) as GraphQLInputObjectType;
      const sortInput = sortInputs.get(table.name) as GraphQLInputObjectType;

      const singularField = singularFieldName(table.name);

      // <singular>(id: ID!): <Singular>
      queryFields[singularField] = {
        type: tableType,
        args: { id: { type: new GraphQLNonNull(GraphQLID) } },
        resolve: getOneResolver(table, customerSchema),
      };

      // <singular>List(...): <Singular>Connection!
      queryFields[`${singularField}List`] = {
        type: new GraphQLNonNull(connectionType),
        args: {
          first: { type: GraphQLInt },
          after: { type: GraphQLString },
          last: { type: GraphQLInt },
          before: { type: GraphQLString },
          filter: { type: filterInput },
          sort: { type: new GraphQLList(new GraphQLNonNull(sortInput)) },
          includeArchived: { type: GraphQLBoolean },
        },
        resolve: listResolver(table, customerSchema),
      };

      // <singular>Count(filter: ...): Int!
      queryFields[`${singularField}Count`] = {
        type: new GraphQLNonNull(GraphQLInt),
        args: {
          filter: { type: filterInput },
          includeArchived: { type: GraphQLBoolean },
        },
        resolve: countResolver(table, customerSchema),
      };
    }

    const QueryType = new GraphQLObjectType({
      name: 'Query',
      fields: queryFields,
    });

    // Phase 6: Build Mutation root
    const mutationFields: Record<string, GraphQLFieldConfig<undefined, GraphQLContext>> = {};

    for (const table of customerSchema.tables) {
      const typeName = singularTypeName(table.name);
      const createInput = createInputTypes.get(table.name) as GraphQLInputObjectType;
      const updateInput = updateInputTypes.get(table.name) as GraphQLInputObjectType;
      const createResult = createResultTypes.get(table.name) as GraphQLUnionType;
      const updateResult = updateResultTypes.get(table.name) as GraphQLUnionType;

      mutationFields[`create${typeName}`] = {
        type: new GraphQLNonNull(createResult),
        args: { input: { type: new GraphQLNonNull(createInput) } },
        resolve: createResolver(table, customerSchema),
      };

      mutationFields[`update${typeName}`] = {
        type: new GraphQLNonNull(updateResult),
        args: {
          id: { type: new GraphQLNonNull(GraphQLID) },
          input: { type: new GraphQLNonNull(updateInput) },
          expectedVersion: { type: GraphQLInt },
        },
        resolve: updateResolver(table, customerSchema),
      };

      mutationFields[`archive${typeName}`] = {
        type: new GraphQLNonNull(GraphQLBoolean),
        args: { id: { type: new GraphQLNonNull(GraphQLID) } },
        resolve: archiveResolver(table, customerSchema),
      };

      mutationFields[`restore${typeName}`] = {
        type: new GraphQLNonNull(GraphQLBoolean),
        args: { id: { type: new GraphQLNonNull(GraphQLID) } },
        resolve: restoreResolver(table, customerSchema),
      };

      mutationFields[`hardDelete${typeName}`] = {
        type: new GraphQLNonNull(GraphQLBoolean),
        args: { id: { type: new GraphQLNonNull(GraphQLID) } },
        resolve: hardDeleteResolver(table, customerSchema),
      };
    }

    const MutationType = new GraphQLObjectType({
      name: 'Mutation',
      fields: mutationFields,
    });

    // Phase 7: Build Subscription stub (Objective 14 fills this in)
    const SubscriptionType = new GraphQLObjectType({
      name: 'Subscription',
      fields: {
        _placeholder: {
          type: GraphQLString,
          description: 'Subscription support implemented in Objective 14.',
          // eslint-disable-next-line @typescript-eslint/require-await
          subscribe: async function* () {
            yield null;
          },
          resolve: () => null,
        },
      },
    });

    // Collect all named types for the schema (avoids "unknown type" errors for union members)
    const extraTypes: GraphQLNamedType[] = [
      PageInfoType,
      FieldErrorType,
      ValidationErrorType,
      ConflictErrorType,
      AuthorizationErrorType,
      DeleteSuccessType,
      SortDirectionEnum,
      filterTypes.string,
      filterTypes.int,
      filterTypes.float,
      filterTypes.boolean,
      filterTypes.id,
      ...tableTypes.values(),
      ...filterInputs.values(),
      ...sortInputs.values(),
      ...connectionTypes.values(),
      ...edgeTypes.values(),
      ...createInputTypes.values(),
      ...updateInputTypes.values(),
    ];

    const schema = new GraphQLSchema({
      query: QueryType,
      mutation: MutationType,
      subscription: SubscriptionType,
      types: extraTypes,
    });

    return { schema, tableTypes, filterInputs, sortInputs, connectionTypes };
  }
}
