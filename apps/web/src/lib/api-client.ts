/**
 * Typed API client for the Platform REST API.
 * All schema operations are workspace-scoped.
 * Handles authentication, error normalization, and type-safe responses.
 */

import type {
  ApiError,
  CreateSchemaInput,
  CustomerSchema,
  ImportSchemaInput,
  MigrationPreview,
  MigrationResult,
  PaginatedResult,
  SchemaChanges,
  SchemaVersion,
  UpdateSchemaInput,
  ValidationReport,
} from './types';

// eslint-disable-next-line no-restricted-syntax -- NEXT_PUBLIC_* vars are client-side only; getEnv() is server-only and must not be called here
const API_BASE = process.env['NEXT_PUBLIC_API_BASE_URL'] ?? 'http://localhost:3000';

export class ApiClientError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly metadata: Record<string, unknown>;

  constructor(apiError: ApiError) {
    super(apiError.message);
    this.name = 'ApiClientError';
    this.code = apiError.code;
    this.statusCode = apiError.statusCode;
    this.metadata = apiError.metadata ?? {};
  }
}

async function request<T>(
  path: string,
  options: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> } = {},
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url, {
    ...options,
    credentials: 'include', // send session cookie
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    let apiError: ApiError;
    try {
      const body = (await response.json()) as unknown;
      if (typeof body === 'object' && body !== null && 'code' in body && 'message' in body) {
        apiError = body as ApiError;
      } else {
        apiError = {
          code: 'UNKNOWN',
          message: `HTTP ${String(response.status)}: ${response.statusText}`,
          statusCode: response.status,
        };
      }
    } catch {
      apiError = {
        code: 'UNKNOWN',
        message: `HTTP ${String(response.status)}: ${response.statusText}`,
        statusCode: response.status,
      };
    }
    const err = new ApiClientError(apiError);
    if (response.status === 401 && typeof window !== 'undefined') {
      window.location.href = `/auth/sign-in?next=${encodeURIComponent(window.location.pathname)}`;
    }
    throw err;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function schemaPath(workspaceId: string, schemaId?: string, suffix?: string): string {
  let path = `/api/v1/workspaces/${workspaceId}/schemas`;
  if (schemaId) path += `/${schemaId}`;
  if (suffix) path += `/${suffix}`;
  return path;
}

export const schemaApi = {
  list(workspaceId: string, cursor?: string): Promise<PaginatedResult<CustomerSchema>> {
    const params = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    return request<PaginatedResult<CustomerSchema>>(schemaPath(workspaceId) + params);
  },

  get(workspaceId: string, schemaId: string): Promise<CustomerSchema> {
    return request<CustomerSchema>(schemaPath(workspaceId, schemaId));
  },

  create(workspaceId: string, input: CreateSchemaInput): Promise<CustomerSchema> {
    return request<CustomerSchema>(schemaPath(workspaceId), {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  update(workspaceId: string, input: UpdateSchemaInput): Promise<CustomerSchema> {
    return request<CustomerSchema>(schemaPath(workspaceId, input.schemaId), {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  delete(workspaceId: string, schemaId: string, expectedVersion: number): Promise<undefined> {
    return request<undefined>(schemaPath(workspaceId, schemaId), {
      method: 'DELETE',
      body: JSON.stringify({ expectedVersion }),
    });
  },

  validate(
    workspaceId: string,
    schemaId: string,
    proposed: SchemaChanges,
  ): Promise<ValidationReport> {
    return request<ValidationReport>(schemaPath(workspaceId, schemaId, 'validate'), {
      method: 'POST',
      body: JSON.stringify(proposed),
    });
  },

  previewMigration(
    workspaceId: string,
    schemaId: string,
    proposed: SchemaChanges,
  ): Promise<MigrationPreview> {
    return request<MigrationPreview>(schemaPath(workspaceId, schemaId, 'preview'), {
      method: 'POST',
      body: JSON.stringify(proposed),
    });
  },

  applyMigration(
    workspaceId: string,
    schemaId: string,
    proposed: SchemaChanges,
    expectedVersion: number,
  ): Promise<MigrationResult> {
    return request<MigrationResult>(schemaPath(workspaceId, schemaId, 'deploy'), {
      method: 'POST',
      body: JSON.stringify({ ...proposed, expectedVersion }),
    });
  },

  listVersions(workspaceId: string, schemaId: string): Promise<SchemaVersion[]> {
    return request<SchemaVersion[]>(schemaPath(workspaceId, schemaId, 'versions'));
  },

  rollback(workspaceId: string, schemaId: string, targetVersion: number): Promise<MigrationResult> {
    return request<MigrationResult>(schemaPath(workspaceId, schemaId, 'rollback'), {
      method: 'POST',
      body: JSON.stringify({ targetVersion }),
    });
  },

  importSchema(workspaceId: string, input: ImportSchemaInput): Promise<CustomerSchema> {
    return request<CustomerSchema>(schemaPath(workspaceId) + '/import', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  exportSchema(workspaceId: string, schemaId: string, format: 'json' | 'yaml'): Promise<string> {
    return request<string>(schemaPath(workspaceId, schemaId, `export?format=${format}`));
  },

  createFromTemplate(
    workspaceId: string,
    templateId: string,
    input: CreateSchemaInput,
  ): Promise<CustomerSchema> {
    return request<CustomerSchema>(schemaPath(workspaceId) + '/from-template', {
      method: 'POST',
      body: JSON.stringify({ templateId, ...input }),
    });
  },
};

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  status: string;
  createdAt: string;
  content: {
    briefDraft: { title?: string };
    messages: { content: string }[];
    totalCostUsd: number | null;
  };
}

export const workspaceApi = {
  list(): Promise<{ items: WorkspaceSummary[] }> {
    return request<{ items: WorkspaceSummary[] }>('/api/v1/workspaces');
  },

  create(input: { name: string; slug: string }): Promise<WorkspaceSummary> {
    return request<WorkspaceSummary>('/api/v1/workspaces', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  delete(id: string): Promise<undefined> {
    return request<undefined>(`/api/v1/workspaces/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
};

export const conversationApi = {
  list(
    workspaceId: string,
    opts?: { limit?: number; cursor?: string },
  ): Promise<{ items: ConversationSummary[] }> {
    const params = new URLSearchParams({ workspaceId });
    if (opts?.limit) params.set('limit', String(opts.limit));
    if (opts?.cursor) params.set('cursor', opts.cursor);
    return request<{ items: ConversationSummary[] }>(
      `/api/v1/ai/intent-capture/conversations?${params.toString()}`,
    );
  },

  start(workspaceId: string, templateId?: string): Promise<ConversationSummary> {
    return request<ConversationSummary>(
      `/api/v1/ai/intent-capture/conversations?workspaceId=${workspaceId}`,
      {
        method: 'POST',
        body: JSON.stringify({ templateId }),
      },
    );
  },
};
