import {
  GraphQLObjectType,
  GraphQLString,
  GraphQLBoolean,
  GraphQLList,
  GraphQLNonNull,
  GraphQLError,
  type GraphQLFieldConfig,
} from 'graphql';
import { uuidv7 } from 'uuidv7';

import type { SubscriptionManager } from '../realtime/subscription-manager.js';
import type { DeliverableEvent } from '../realtime/types.js';
import type { CustomerSchema, CustomerTableDefinition } from '../schema-model.js';
import type { GraphQLContext } from './request-handler.js';

// ── GraphQL subscription context extension ─────────────────────────────────────

export interface GraphQLSubscriptionContext extends GraphQLContext {
  connectionId: string;
  subscriptions: SubscriptionManager;
}

// ── Per-table subscription field builder ───────────────────────────────────────

/**
 * Build subscription fields for every table in `customerSchema`.
 *
 * For a table named `users`, this produces:
 *   `usersChanges(filter: ..., operations: [insert, update, delete], snapshot: Boolean): UsersChangeEvent`
 */
export function buildSubscriptionFields(
  customerSchema: CustomerSchema,
): Record<string, GraphQLFieldConfig<unknown, GraphQLSubscriptionContext>> {
  const fields: Record<string, GraphQLFieldConfig<unknown, GraphQLSubscriptionContext>> = {};

  for (const table of customerSchema.tables) {
    const fieldName = `${toCamelCase(table.name)}Changes`;
    fields[fieldName] = buildTableSubscriptionField(table, customerSchema);
  }

  return fields;
}

// ── ChangeEvent output type ────────────────────────────────────────────────────

let _changeEventType: GraphQLObjectType | null = null;

function getChangeEventType(): GraphQLObjectType {
  if (_changeEventType) return _changeEventType;

  _changeEventType = new GraphQLObjectType({
    name: 'ChangeEvent',
    description: 'A change event delivered by a real-time subscription.',
    fields: {
      subscriptionId: { type: new GraphQLNonNull(GraphQLString) },
      kind: {
        type: new GraphQLNonNull(GraphQLString),
        description:
          'Event kind: data | snapshot_row | snapshot_complete | heartbeat | gap | schema_change | error',
      },
      operation: {
        type: GraphQLString,
        description: 'Database operation: insert | update | delete | truncate',
      },
      table: { type: new GraphQLNonNull(GraphQLString) },
      before: {
        type: GraphQLString,
        description: 'Previous row state as JSON string. Present for update/delete.',
      },
      after: {
        type: GraphQLString,
        description: 'New row state as JSON string. Present for insert/update.',
      },
      position: { type: new GraphQLNonNull(GraphQLString) },
      occurredAt: { type: new GraphQLNonNull(GraphQLString) },
      redacted: {
        type: new GraphQLList(new GraphQLNonNull(GraphQLString)),
        description: 'Column names whose values were redacted due to missing PII permission.',
      },
    },
  });

  return _changeEventType;
}

// ── Individual table subscription field ────────────────────────────────────────

function buildTableSubscriptionField(
  table: CustomerTableDefinition,
  customerSchema: CustomerSchema,
): GraphQLFieldConfig<unknown, GraphQLSubscriptionContext> {
  return {
    type: new GraphQLNonNull(getChangeEventType()),
    description: `Subscribe to changes on the '${table.name}' table.`,
    args: {
      operations: {
        type: new GraphQLList(new GraphQLNonNull(GraphQLString)),
        description: 'Filter by operation type (insert, update, delete, truncate).',
      },
      snapshot: {
        type: GraphQLBoolean,
        defaultValue: false,
        description: 'When true, emit existing rows before live events.',
      },
      resumeToken: {
        type: GraphQLString,
        description: 'Opaque token from a prior subscription to resume after disconnect.',
      },
    },

    subscribe: async function* (
      _parent: unknown,
      args: { operations?: string[]; snapshot?: boolean; resumeToken?: string },
      context: GraphQLSubscriptionContext,
    ): AsyncGenerator<DeliverableEvent> {
      const { ctx, connectionId, subscriptions } = context;

      const subscriptionId = uuidv7();
      const mode = args.snapshot ? 'snapshot_then_stream' : 'stream';

      const subResult = args.resumeToken
        ? subscriptions.resume(
            {
              connectionId,
              subscriptionId,
              workspaceId: ctx.workspaceId ?? '',
              schemaId: customerSchema.id,
              tableId: table.name,
              tableDef: table,
              mode,
              resumeToken: args.resumeToken,
            },
            ctx,
          )
        : subscriptions.subscribe(
            {
              connectionId,
              subscriptionId,
              workspaceId: ctx.workspaceId ?? '',
              schemaId: customerSchema.id,
              tableId: table.name,
              tableDef: table,
              operations: args.operations as Array<'insert' | 'update' | 'delete' | 'truncate'>,
              mode,
            },
            ctx,
          );

      if (subResult.isErr()) {
        throw new GraphQLError(subResult.error.message, {
          extensions: { code: subResult.error.code },
        });
      }

      try {
        for await (const event of subResult.value.events) {
          yield event;
        }
      } finally {
        subResult.value.cancel();
      }
    },

    resolve: (source: unknown) => {
      const event = source as DeliverableEvent;
      return {
        ...event,
        before: event.before ? JSON.stringify(event.before) : null,
        after: event.after ? JSON.stringify(event.after) : null,
      };
    },
  };
}

// ── Naming helper ──────────────────────────────────────────────────────────────

function toCamelCase(name: string): string {
  return name.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}
