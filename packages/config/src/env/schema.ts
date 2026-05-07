import { z } from 'zod';

// ========== CLIENT-EXPOSED ==========

export const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_ENV: z.enum(['development', 'staging', 'production']),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_BRAND_NAME: z.string().default('Platform'),
});

// ========== SERVER-ONLY (FOUNDATION) ==========

const foundationEnvSchema = z.object({
  APP_ENV: z.enum(['development', 'staging', 'production']),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  PORT: z.coerce.number().int().positive().default(3000),
  DOMAIN: z.string(),
  ADMIN_EMAIL: z.string().email(),
});

// ========== ADAPTER SELECTION ==========

const adapterSelectionSchema = z.object({
  DATABASE_DRIVER: z.enum(['postgres', 'mssql', 'mongo']).default('postgres'),
  IDENTITY_DRIVER: z.enum(['builtin', 'entra', 'oidc', 'saml']).default('builtin'),
  STORAGE_DRIVER: z.enum(['local', 's3', 'azure_blob']).default('local'),
  EMAIL_DRIVER: z.enum(['smtp', 'ses', 'sendgrid']).default('smtp'),
  EVENTBUS_DRIVER: z.enum(['inproc', 'redis', 'postgres']).default('redis'),
  JOBS_DRIVER: z.enum(['postgres', 'mssql', 'redis']).default('postgres'),
  AI_DRIVER: z.enum(['claude_cli', 'anthropic_api', 'azure_openai']).default('claude_cli'),
  VECTORSTORE_DRIVER: z.enum(['pgvector', 'qdrant', 'azure_search', 'inproc']).default('pgvector'),
});

// ========== POSTGRES ADAPTER ==========

const postgresEnvSchema = z.object({
  POSTGRES_URL: z.string().url(),
  // Bypasses pgbouncer for migrations — needed for schema changes
  POSTGRES_DIRECT_URL: z.string().url().optional(),
  POSTGRES_POOL_SIZE: z.coerce.number().int().positive().default(10),
});

// ========== MSSQL ADAPTER ==========

const mssqlEnvSchema = z.object({
  MSSQL_SERVER: z.string().optional(),
  MSSQL_PORT: z.coerce.number().int().positive().default(1433),
  MSSQL_DATABASE: z.string().optional(),
  MSSQL_USER: z.string().optional(),
  MSSQL_PASSWORD: z.string().optional(),
  MSSQL_ENCRYPT: z.coerce.boolean().default(false),
  MSSQL_TRUSTED_CONNECTION: z.coerce.boolean().default(false),
});

// ========== MONGO ADAPTER ==========

const mongoEnvSchema = z.object({
  MONGO_URL: z.string().url().optional(),
  MONGO_DATABASE: z.string().optional(),
});

// ========== IDENTITY (BUILTIN) ==========

const identityBuiltinSchema = z.object({
  AUTH_SECRET: z.string().min(32),
  AUTH_SESSION_DURATION_DAYS: z.coerce.number().int().positive().default(30),
});

// ========== IDENTITY (ENTRA / OIDC / SAML) ==========

const identityEnterpriseSchema = z.object({
  OIDC_ISSUER_URL: z.string().url().optional(),
  OIDC_CLIENT_ID: z.string().optional(),
  OIDC_CLIENT_SECRET: z.string().optional(),
  OIDC_REDIRECT_URI: z.string().url().optional(),
  SAML_METADATA_URL: z.string().url().optional(),
  SAML_CERT: z.string().optional(),
});

// ========== STORAGE (LOCAL) ==========

const storageLocalSchema = z.object({
  STORAGE_LOCAL_PATH: z.string().default('/var/platform/storage'),
});

// ========== STORAGE (S3) ==========

const storageS3Schema = z.object({
  STORAGE_S3_ENDPOINT: z.string().url().optional(),
  STORAGE_S3_REGION: z.string().optional(),
  STORAGE_S3_BUCKET: z.string().optional(),
  STORAGE_S3_ACCESS_KEY: z.string().optional(),
  STORAGE_S3_SECRET_KEY: z.string().optional(),
  STORAGE_S3_PATH_STYLE: z.coerce.boolean().default(false),
});

// ========== STORAGE (AZURE BLOB) ==========

const storageAzureSchema = z.object({
  STORAGE_AZURE_ACCOUNT: z.string().optional(),
  STORAGE_AZURE_KEY: z.string().optional(),
  STORAGE_AZURE_CONTAINER: z.string().optional(),
});

// ========== EMAIL ==========

const emailSchema = z.object({
  EMAIL_FROM: z.string().email().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SES_REGION: z.string().optional(),
  SENDGRID_API_KEY: z.string().optional(),
});

// ========== OBSERVABILITY ==========

const observabilitySchema = z.object({
  /** OTLP HTTP endpoint for the OTel Collector. e.g. http://otel-collector:4318 */
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  /** GlitchTip / Sentry DSN for error tracking. */
  SENTRY_DSN: z.string().optional(),
  /** Set to 'true' to pretty-print logs to console (dev only). */
  LOG_PRETTY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  /** Set to 'false' to disable all OTel/Sentry telemetry (local dev without stack). */
  OBS_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v !== 'false'),
  /** Service name for telemetry enrichment. */
  SERVICE_NAME: z.string().default('platform'),
  /** Deployed version / git SHA, used in release tags. */
  SERVICE_VERSION: z.string().default('unknown'),
});

// ========== AI / WORKER ==========

const aiWorkerSchema = z.object({
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(2000),
  WORKER_JOB_TIMEOUT_MS: z.coerce.number().int().positive().default(300_000),
  WORKER_MAX_CONCURRENCY: z.coerce.number().int().positive().default(1),
  CLAUDE_CLI_PATH: z.string().default('claude'),
  CLAUDE_CLI_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
  ANTHROPIC_API_KEY: z.string().optional(),
  AZURE_OPENAI_ENDPOINT: z.string().url().optional(),
  AZURE_OPENAI_KEY: z.string().optional(),
});

// ========== REDIS ==========

const redisSchema = z.object({
  REDIS_URL: z.string().url().optional(),
});

// ========== COMPOSED SERVER SCHEMA ==========
// All adapter-specific schemas are merged as .partial() — the superRefine below enforces
// that the required vars for the chosen driver are actually present.

export const serverEnvSchema = foundationEnvSchema
  .merge(adapterSelectionSchema)
  .merge(postgresEnvSchema.partial())
  .merge(mssqlEnvSchema.partial())
  .merge(mongoEnvSchema.partial())
  .merge(identityBuiltinSchema.partial())
  .merge(identityEnterpriseSchema.partial())
  .merge(storageLocalSchema.partial())
  .merge(storageS3Schema.partial())
  .merge(storageAzureSchema.partial())
  .merge(emailSchema.partial())
  .merge(observabilitySchema)
  .merge(aiWorkerSchema.partial())
  .merge(redisSchema.partial())
  .superRefine((v, ctx) => {
    if (v.DATABASE_DRIVER === 'postgres' && !v.POSTGRES_URL) {
      ctx.addIssue({
        code: 'custom',
        message: 'POSTGRES_URL is required when DATABASE_DRIVER=postgres',
        path: ['POSTGRES_URL'],
      });
    }
    if (v.DATABASE_DRIVER === 'mssql') {
      if (!v.MSSQL_SERVER || !v.MSSQL_DATABASE) {
        ctx.addIssue({
          code: 'custom',
          message: 'MSSQL_SERVER and MSSQL_DATABASE are required when DATABASE_DRIVER=mssql',
          path: ['MSSQL_SERVER'],
        });
      }
      if (!v.MSSQL_TRUSTED_CONNECTION && (!v.MSSQL_USER || !v.MSSQL_PASSWORD)) {
        ctx.addIssue({
          code: 'custom',
          message:
            'MSSQL_USER and MSSQL_PASSWORD are required when DATABASE_DRIVER=mssql and MSSQL_TRUSTED_CONNECTION is not set',
          path: ['MSSQL_USER'],
        });
      }
    }
    if (v.DATABASE_DRIVER === 'mongo' && !v.MONGO_URL) {
      ctx.addIssue({
        code: 'custom',
        message: 'MONGO_URL is required when DATABASE_DRIVER=mongo',
        path: ['MONGO_URL'],
      });
    }
    if (v.IDENTITY_DRIVER === 'builtin' && !v.AUTH_SECRET) {
      ctx.addIssue({
        code: 'custom',
        message: 'AUTH_SECRET is required when IDENTITY_DRIVER=builtin',
        path: ['AUTH_SECRET'],
      });
    }
    if (v.IDENTITY_DRIVER === 'oidc' && (!v.OIDC_ISSUER_URL || !v.OIDC_CLIENT_ID)) {
      ctx.addIssue({
        code: 'custom',
        message: 'OIDC_ISSUER_URL and OIDC_CLIENT_ID are required when IDENTITY_DRIVER=oidc',
        path: ['OIDC_ISSUER_URL'],
      });
    }
    if (v.IDENTITY_DRIVER === 'saml' && !v.SAML_METADATA_URL) {
      ctx.addIssue({
        code: 'custom',
        message: 'SAML_METADATA_URL is required when IDENTITY_DRIVER=saml',
        path: ['SAML_METADATA_URL'],
      });
    }
    if (v.STORAGE_DRIVER === 's3') {
      const missingS3 = (
        ['STORAGE_S3_BUCKET', 'STORAGE_S3_ACCESS_KEY', 'STORAGE_S3_SECRET_KEY'] as const
      ).filter((k) => !v[k]);
      if (missingS3.length > 0) {
        ctx.addIssue({
          code: 'custom',
          message: `${missingS3.join(', ')} are required when STORAGE_DRIVER=s3`,
          path: [missingS3[0] as string],
        });
      }
    }
    if (v.STORAGE_DRIVER === 'azure_blob') {
      const missingAzure = (
        ['STORAGE_AZURE_ACCOUNT', 'STORAGE_AZURE_KEY', 'STORAGE_AZURE_CONTAINER'] as const
      ).filter((k) => !v[k]);
      if (missingAzure.length > 0) {
        ctx.addIssue({
          code: 'custom',
          message: `${missingAzure.join(', ')} are required when STORAGE_DRIVER=azure_blob`,
          path: [missingAzure[0] as string],
        });
      }
    }
    if (v.EMAIL_DRIVER === 'ses' && !v.SES_REGION) {
      ctx.addIssue({
        code: 'custom',
        message: 'SES_REGION is required when EMAIL_DRIVER=ses',
        path: ['SES_REGION'],
      });
    }
    if (v.EMAIL_DRIVER === 'sendgrid' && !v.SENDGRID_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        message: 'SENDGRID_API_KEY is required when EMAIL_DRIVER=sendgrid',
        path: ['SENDGRID_API_KEY'],
      });
    }
    if (v.EVENTBUS_DRIVER === 'redis' && !v.REDIS_URL) {
      ctx.addIssue({
        code: 'custom',
        message: 'REDIS_URL is required when EVENTBUS_DRIVER=redis',
        path: ['REDIS_URL'],
      });
    }
    if (v.AI_DRIVER === 'anthropic_api' && !v.ANTHROPIC_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        message: 'ANTHROPIC_API_KEY is required when AI_DRIVER=anthropic_api',
        path: ['ANTHROPIC_API_KEY'],
      });
    }
    if (v.AI_DRIVER === 'azure_openai' && (!v.AZURE_OPENAI_ENDPOINT || !v.AZURE_OPENAI_KEY)) {
      ctx.addIssue({
        code: 'custom',
        message:
          'AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_KEY are required when AI_DRIVER=azure_openai',
        path: ['AZURE_OPENAI_ENDPOINT'],
      });
    }
  });

export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;
