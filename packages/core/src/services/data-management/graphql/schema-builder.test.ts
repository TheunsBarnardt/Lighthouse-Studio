import { parse as gqlParse, validate, specifiedRules } from 'graphql';
import { describe, it, expect } from 'vitest';

import type { CustomerSchema } from '../schema-model.js';

import { GraphQLSchemaBuilder } from './schema-builder.js';

// ── Minimal test schema fixtures ───────────────────────────────────────────────

const MINIMAL_SCHEMA: CustomerSchema = {
  id: 'schema-001',
  workspaceId: 'ws-001',
  name: 'Blog',
  slug: 'blog',
  version: 1,
  databaseDriver: 'postgres',
  tables: [
    {
      id: 'tbl-users',
      name: 'users',
      columns: [
        { id: 'col-id', name: 'id', type: { kind: 'uuid' }, nullable: false },
        { id: 'col-email', name: 'email', type: { kind: 'string', length: 255 }, nullable: false },
        { id: 'col-name', name: 'full_name', type: { kind: 'text' }, nullable: true },
        {
          id: 'col-active',
          name: 'active',
          type: { kind: 'boolean' },
          nullable: false,
          defaultValue: { kind: 'literal', value: true },
        },
        {
          id: 'col-created',
          name: 'created_at',
          type: { kind: 'timestamp_tz' },
          nullable: false,
          defaultValue: { kind: 'function', name: 'now' },
        },
      ],
      indexes: [],
      foreignKeys: [],
      constraints: [],
      primaryKey: { kind: 'single', columnId: 'col-id' },
    },
    {
      id: 'tbl-posts',
      name: 'posts',
      columns: [
        { id: 'col-pid', name: 'id', type: { kind: 'uuid' }, nullable: false },
        { id: 'col-title', name: 'title', type: { kind: 'string', length: 500 }, nullable: false },
        { id: 'col-body', name: 'body', type: { kind: 'text' }, nullable: true },
        { id: 'col-author', name: 'author_id', type: { kind: 'uuid' }, nullable: false },
      ],
      indexes: [],
      foreignKeys: [
        {
          id: 'fk-author',
          name: 'posts_author_id_fkey',
          columns: ['col-author'],
          referencedTableId: 'tbl-users',
          referencedColumns: ['col-id'],
          onDelete: 'restrict',
          onUpdate: 'no_action',
        },
      ],
      constraints: [],
      primaryKey: { kind: 'single', columnId: 'col-pid' },
    },
  ],
  metadata: {
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    createdBy: 'test',
    updatedBy: 'test',
  },
};

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('GraphQLSchemaBuilder', () => {
  const builder = new GraphQLSchemaBuilder();

  describe('getOrBuild', () => {
    it('builds a valid GraphQL schema', () => {
      const { schema } = builder.getOrBuild(MINIMAL_SCHEMA);
      expect(schema).toBeDefined();
    });

    it('returns cached schema on second call', () => {
      const first = builder.getOrBuild(MINIMAL_SCHEMA);
      const second = builder.getOrBuild(MINIMAL_SCHEMA);
      expect(first.schema).toBe(second.schema);
    });

    it('invalidates cache after invalidate() call', () => {
      const first = builder.getOrBuild(MINIMAL_SCHEMA);
      builder.invalidate(MINIMAL_SCHEMA.id);
      const second = builder.getOrBuild(MINIMAL_SCHEMA);
      expect(first.schema).not.toBe(second.schema);
    });
  });

  describe('Query type', () => {
    it('generates a user field for each table', () => {
      const { schema } = builder.getOrBuild(MINIMAL_SCHEMA);
      const query = schema.getQueryType();
      expect(query).toBeDefined();
      const fields = query!.getFields();
      expect(fields['user']).toBeDefined();
      expect(fields['post']).toBeDefined();
    });

    it('generates <table>List connection fields', () => {
      const { schema } = builder.getOrBuild(MINIMAL_SCHEMA);
      const query = schema.getQueryType()!;
      const fields = query.getFields();
      expect(fields['userList']).toBeDefined();
      expect(fields['postList']).toBeDefined();
    });

    it('generates <table>Count fields', () => {
      const { schema } = builder.getOrBuild(MINIMAL_SCHEMA);
      const query = schema.getQueryType()!;
      expect(query.getFields()['userCount']).toBeDefined();
      expect(query.getFields()['postCount']).toBeDefined();
    });
  });

  describe('Mutation type', () => {
    it('generates createUser mutation', () => {
      const { schema } = builder.getOrBuild(MINIMAL_SCHEMA);
      const mutation = schema.getMutationType();
      expect(mutation).toBeDefined();
      expect(mutation!.getFields()['createUser']).toBeDefined();
    });

    it('generates updateUser, archiveUser, restoreUser, hardDeleteUser', () => {
      const { schema } = builder.getOrBuild(MINIMAL_SCHEMA);
      const fields = schema.getMutationType()!.getFields();
      expect(fields['updateUser']).toBeDefined();
      expect(fields['archiveUser']).toBeDefined();
      expect(fields['restoreUser']).toBeDefined();
      expect(fields['hardDeleteUser']).toBeDefined();
    });
  });

  describe('Object types', () => {
    it('generates User type with camelCase fields', () => {
      const { schema } = builder.getOrBuild(MINIMAL_SCHEMA);
      const userType = schema.getType('User');
      expect(userType).toBeDefined();
      // @ts-expect-error — getFields() exists on GraphQLObjectType
      const fields = userType!.getFields();
      expect(fields['id']).toBeDefined();
      expect(fields['email']).toBeDefined();
      expect(fields['fullName']).toBeDefined(); // snake_case → camelCase
      expect(fields['active']).toBeDefined();
    });

    it('generates UserConnection, UserEdge, PageInfo', () => {
      const { schema } = builder.getOrBuild(MINIMAL_SCHEMA);
      expect(schema.getType('UserConnection')).toBeDefined();
      expect(schema.getType('UserEdge')).toBeDefined();
      expect(schema.getType('PageInfo')).toBeDefined();
    });
  });

  describe('Filter input types', () => {
    it('generates UserFilterInput with column fields', () => {
      const { schema } = builder.getOrBuild(MINIMAL_SCHEMA);
      const filterType = schema.getType('UserFilterInput');
      expect(filterType).toBeDefined();
      // @ts-expect-error — getFields() on GraphQLInputObjectType
      const fields = filterType!.getFields();
      expect(fields['email']).toBeDefined();
      expect(fields['active']).toBeDefined();
      expect(fields['_and']).toBeDefined();
      expect(fields['_or']).toBeDefined();
      expect(fields['_not']).toBeDefined();
    });
  });

  describe('Mutation result types', () => {
    it('generates CreateUserResult union type', () => {
      const { schema } = builder.getOrBuild(MINIMAL_SCHEMA);
      const resultType = schema.getType('CreateUserResult');
      expect(resultType).toBeDefined();
    });

    it('generates CreateUserSuccess type', () => {
      const { schema } = builder.getOrBuild(MINIMAL_SCHEMA);
      const successType = schema.getType('CreateUserSuccess');
      expect(successType).toBeDefined();
    });
  });

  describe('Foreign key relationships', () => {
    it('generates author field on Post (to-one FK)', () => {
      const { schema } = builder.getOrBuild(MINIMAL_SCHEMA);
      const postType = schema.getType('Post');
      expect(postType).toBeDefined();
      // @ts-expect-error — getFields()
      const fields = postType!.getFields();
      expect(fields['users']).toBeDefined(); // to-one FK to users table
    });

    it('generates postList field on User (to-many FK)', () => {
      const { schema } = builder.getOrBuild(MINIMAL_SCHEMA);
      const userType = schema.getType('User');
      // @ts-expect-error — getFields()
      const fields = userType!.getFields();
      expect(fields['postsList']).toBeDefined(); // to-many from posts back to user
    });
  });

  describe('Schema introspection query', () => {
    it('introspection query validates against the generated schema', () => {
      const { schema } = builder.getOrBuild(MINIMAL_SCHEMA);
      const introspectionQuery = `{ __schema { queryType { name } } }`;
      const doc = gqlParse(introspectionQuery);
      const errors = validate(schema, doc, specifiedRules);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Query validation', () => {
    it('valid list query passes validation', () => {
      const { schema } = builder.getOrBuild(MINIMAL_SCHEMA);
      const query = `
        query GetUsers {
          userList(first: 10) {
            edges { node { id email } }
            pageInfo { hasNextPage endCursor }
          }
        }
      `;
      const errors = validate(schema, gqlParse(query), specifiedRules);
      expect(errors).toHaveLength(0);
    });

    it('valid mutation query passes validation', () => {
      const { schema } = builder.getOrBuild(MINIMAL_SCHEMA);
      const query = `
        mutation CreateUser($input: CreateUserInput!) {
          createUser(input: $input) {
            __typename
            ... on CreateUserSuccess { user { id email } }
            ... on ValidationError { errors { field message } }
          }
        }
      `;
      const errors = validate(schema, gqlParse(query), specifiedRules);
      expect(errors).toHaveLength(0);
    });

    it('unknown field fails validation', () => {
      const { schema } = builder.getOrBuild(MINIMAL_SCHEMA);
      const query = `{ userList(first: 5) { edges { node { nonExistentField } } } }`;
      const errors = validate(schema, gqlParse(query), specifiedRules);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
