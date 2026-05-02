# Contract: Config

> Ports: `@platform/ports-config` — `SecretStorePort`, `FeatureFlagPort`

## Purpose

`SecretStorePort` provides a unified interface for reading and writing secrets (API keys, database URLs, signing keys, third-party credentials). It abstracts over environment variables, a built-in secrets manager, and external vaults (HashiCorp Vault, Azure Key Vault, AWS Secrets Manager). Adapters handle decryption internally; callers always receive plaintext strings.

`FeatureFlagPort` provides runtime feature toggling. It supports context-aware evaluation — the same flag can return different values for different users, workspaces, or attributes. `FeatureFlagPort` is nullable in the container; it is only wired when a feature flag system is configured.

The cardinal rule for both ports: **no direct `process.env` access anywhere in application code**. All configuration reads go through `SecretStorePort` or `FeatureFlagPort`. This is enforced by linting.

---

## Types

```typescript
interface FlagContext {
  userId?: string;
  workspaceId?: string;
  attributes?: Record<string, unknown>;
}

type ConfigErrorCode = 'KEY_NOT_FOUND' | 'ACCESS_DENIED' | 'UNKNOWN';
```

---

## Methods

### `SecretStorePort`

#### `get(key): Promise<Result<string, ConfigError>>`

Retrieves the plaintext value of a secret by key. The adapter performs any required decryption before returning.

**Pre-conditions:** `key` is a non-empty string. Key naming convention: `SCREAMING_SNAKE_CASE` for environment-variable-mapped keys (e.g., `DATABASE_URL`, `JWT_SECRET`); `platform/scope/name` path style for vault-stored secrets (e.g., `platform/smtp/password`).

**Post-conditions:**

- Returns `ok(value)` as a plaintext string on success.
- Returns `err({ code: 'KEY_NOT_FOUND', ... })` when the key does not exist in the configured store.
- Returns `err({ code: 'ACCESS_DENIED', ... })` when the adapter can reach the store but the process lacks permission to read the key (relevant for Vault and cloud key store adapters).
- Returns `err({ code: 'UNKNOWN', ... })` for transient failures (network timeout, store unreachable).
- Never returns the raw encrypted value. Decryption is the adapter's responsibility.

---

#### `set(key, value): Promise<Result<void, ConfigError>>`

Writes or overwrites a secret. This method is optional in production — the env-var adapter does not support writes and returns `err({ code: 'UNKNOWN', message: 'NOT_SUPPORTED' })`.

**Pre-conditions:** `key` and `value` are non-empty strings. The adapter may enforce key-naming constraints.

**Post-conditions:**

- Returns `ok(undefined)` on success.
- On adapters that do not support writes (env-var), returns an error rather than silently succeeding.
- The adapter encrypts `value` before storage if the backend requires it.

**Intended callers:** The platform's built-in secrets manager UI (settings surface) and automated provisioning flows. Service code should not call `set()` at runtime except in provisioning paths.

---

#### `delete(key): Promise<Result<void, ConfigError>>`

Removes a secret from the store.

**Pre-conditions:** `key` is non-empty.

**Post-conditions:**

- Returns `ok(undefined)` on success, including when the key did not exist (idempotent on most adapters).
- Env-var adapter: returns `err({ code: 'UNKNOWN', message: 'NOT_SUPPORTED' })`.
- The deletion is immediate; subsequent `get(key)` calls return `err({ code: 'KEY_NOT_FOUND', ... })`.

---

#### `list(): Promise<Result<string[], ConfigError>>`

Returns all key names visible to this adapter. Values are not returned.

**Post-conditions:**

- Returns `ok([])` when no keys exist or no keys are visible to the process.
- Env-var adapter: returns the names of all environment variables set in `process.env`.
- Vault and cloud adapters: returns keys scoped to the configured path prefix.
- Key names are returned in no guaranteed order.

---

### `FeatureFlagPort`

`FeatureFlagPort` is nullable in the container. Components that consume it must guard against null:

```typescript
const enabled = this.featureFlags ? (await this.featureFlags.isEnabled('new-schema-editor', ctx)).unwrapOr(false) : false;
```

#### `isEnabled(flag, context?): Promise<Result<boolean, ConfigError>>`

Evaluates a boolean feature flag for the given context.

**Pre-conditions:** `flag` is a non-empty string matching a defined flag in the configured backend. Passing an undefined flag name is not a pre-condition violation — the adapter returns a default value rather than an error.

**Post-conditions:**

- Returns `ok(true)` or `ok(false)`.
- When `flag` does not exist in the backend, the in-memory adapter returns `ok(false)` (safe default). Production adapters behave according to their backend's undefined-flag policy (typically `ok(false)` as well).
- `context` fields are used for targeting rules. Evaluation is deterministic for the same `flag` + `context` combination within a single backend update cycle.

---

#### `getVariant(flag, context?): Promise<Result<string, ConfigError>>`

Evaluates a multi-variant (non-boolean) feature flag.

**Pre-conditions:** `flag` is non-empty and corresponds to a multi-variant flag in the backend. Calling `getVariant` on a boolean flag returns the string `'true'` or `'false'` on most adapters.

**Post-conditions:**

- Returns `ok(variantName)` — a non-empty string identifier for the selected variant (e.g., `'control'`, `'treatment-a'`).
- Returns `err({ code: 'KEY_NOT_FOUND', ... })` only when the adapter cannot evaluate the flag at all (e.g., backend unreachable and no cached state). Unknown flag names are handled gracefully (return a default variant string, not an error).

---

#### `listFlags(): Promise<Result<string[], ConfigError>>`

Returns all flag names known to the adapter.

**Post-conditions:**

- Returns `ok([])` for the in-memory adapter unless flags were seeded.
- Returns `ok(flagNames)` — names only, no values or metadata.

---

## Capability Flags

| Flag                            | Meaning                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------ |
| `config.secretsWritable`        | `SecretStorePort.set()` and `.delete()` are supported by the configured adapter            |
| `config.featureFlagsEnabled`    | `FeatureFlagPort` is non-null and connected to a real backend                              |
| `config.secretsEncryptedAtRest` | The configured secrets adapter encrypts values at rest (not env-var)                       |
| `config.flagContextSupport`     | The `FeatureFlagPort` adapter evaluates `FlagContext` targeting rules (not always-default) |

---

## Performance Expectations

| Operation                                                           | Target latency                                          |
| ------------------------------------------------------------------- | ------------------------------------------------------- |
| `SecretStorePort.get` (env-var adapter)                             | < 1 µs (synchronous map lookup wrapped in async)        |
| `SecretStorePort.get` (Vault/cloud adapter)                         | < 50 ms p99 with caching; < 500 ms p99 cold             |
| `FeatureFlagPort.isEnabled` (in-memory)                             | < 1 µs                                                  |
| `FeatureFlagPort.isEnabled` (Unleash/LaunchDarkly with local cache) | < 1 ms (SDK evaluates locally against a cached ruleset) |

Production secret store adapters (Vault, Azure Key Vault, AWS Secrets Manager) must implement a local cache with a configurable TTL (default: 60 seconds). Calling `get()` on a hot path without caching at the adapter level will degrade performance under load and may exhaust rate limits on cloud backends.

---

## Known Adapter Divergences

| Behaviour            | Env-var                             | Built-in secrets manager   | Vault / Cloud KMS             |
| -------------------- | ----------------------------------- | -------------------------- | ----------------------------- |
| `set()` / `delete()` | NOT_SUPPORTED                       | Supported                  | Supported (Vault, AWS, Azure) |
| Encryption at rest   | None (plaintext env)                | AES-256 via platform key   | Provider-managed              |
| `list()` scope       | All `process.env` keys              | Platform-managed keys only | Path-prefix-scoped            |
| Caching              | Implicit (process.env is in-memory) | Configurable TTL           | Configurable TTL; required    |
| Rotation support     | Manual restart required             | Hot-reload supported       | Hot-reload supported          |
| Auth mechanism       | None                                | Platform session           | Token / IAM role              |

| Behaviour           | In-memory (flags)    | Unleash                 | LaunchDarkly            |
| ------------------- | -------------------- | ----------------------- | ----------------------- |
| `isEnabled` default | Always `false`       | Backend-defined default | Backend-defined default |
| Context targeting   | No targeting         | Full SDK targeting      | Full SDK targeting      |
| Flag sync           | Seed at construction | Server-side events      | Streaming / polling     |
| `getVariant`        | Returns `'default'`  | Returns variant string  | Returns variation key   |

---

## Usage Examples

```typescript
// Reading a secret at service startup
const dbUrlResult = await this.secretStore.get('DATABASE_URL');
if (dbUrlResult.isErr()) {
  this.log.error('Failed to read DATABASE_URL', dbUrlResult.error);
  throw new Error('Cannot start: missing DATABASE_URL');
}
const dbUrl = dbUrlResult.value;

// Reading a secret with a fallback (optional config)
const webhookSecret = await this.secretStore.get('WEBHOOK_SECRET').then((r) => r.unwrapOr(null));

// Writing a secret (provisioning flow only)
const writeResult = await this.secretStore.set('SMTP_PASSWORD', generatedPassword);
if (writeResult.isErr()) {
  return err(new AppError('Failed to store SMTP password', writeResult.error));
}

// Checking a feature flag (FeatureFlagPort may be null)
const showNewEditor = this.featureFlags
  ? (
      await this.featureFlags.isEnabled('schema-editor-v2', {
        workspaceId: ctx.workspaceId,
        userId: ctx.actorId,
      })
    ).unwrapOr(false)
  : false;

// Choosing a variant
const variant = this.featureFlags
  ? (
      await this.featureFlags.getVariant('onboarding-flow', {
        userId: ctx.actorId,
      })
    ).unwrapOr('control')
  : 'control';
```

---

## Common Misuse

**Calling `process.env` directly in application code.** All environment variable reads must go through `SecretStorePort`. The env-var adapter wraps `process.env`; calling it directly bypasses the abstraction, making the code impossible to test with alternative secret adapters and impossible to migrate to a vault. Linting rules enforce this.

**Not handling `KEY_NOT_FOUND` explicitly.** Many secrets are required for the service to function. Treating a missing required secret as a non-fatal error (e.g., silently using an empty string) causes confusing runtime failures later. Check the result immediately after `get()` for required keys and fail loudly at startup.

**Calling `set()` without checking adapter capability.** The env-var adapter does not support writes. Code that calls `set()` must either verify via capability flag that the adapter supports writes, or be restricted to provisioning paths where a writable adapter is guaranteed.

**Using `FeatureFlagPort` without null-checking.** `FeatureFlagPort` is nullable in the container. Accessing it without a null guard causes a null dereference when the flag system is not configured. Always guard with `if (this.featureFlags)` or use `?.` with a fallback default.

**Caching secrets indefinitely in a service instance.** Secrets may be rotated without restarting the service (on vault-backed adapters). Reading a secret once at startup and caching it forever in a field means the service will use a stale value after rotation. For long-lived services, re-read secrets periodically or use the adapter's built-in rotation support.

**Logging secret values.** Never pass a secret's value to `LoggerPort` or include it in error messages, `AuditEntry.metadata`, or response payloads. Log the key name (e.g., `'SMTP_PASSWORD'`) and the error kind — never the value. The `SecretStorePort` abstraction exists partly to make these mistakes easier to audit.

**Treating feature flag evaluation as infallible.** `isEnabled` returns a `Result`. Network-backed adapters can fail. Always provide a safe default via `.unwrapOr(false)` — defaulting to the disabled/control path is the correct fallback for a flag evaluation failure.
