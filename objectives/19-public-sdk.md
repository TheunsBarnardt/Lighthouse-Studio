# Objective 19: Public SDK (The Supabase Client Equivalent)

**Status:** Ready for development
**Prerequisites:** Objectives 11–18 complete (the entire Data Management Module surface)
**Blocks:** Customer developers building applications on top of the platform; the Data Management Module's "shippability" depends on this

---

## 1. Purpose

Wrap every customer-facing surface of the Data Management Module — REST APIs, GraphQL APIs, Realtime subscriptions, Storage, Auth, Query Console — into a **single, ergonomic, typed SDK** that customer developers use to build their applications.

This is the artifact customers actually depend on. The schema designer and data browser are tools they use through the platform's UI; the SDK is the code they write into their own application. When a customer's frontend developer writes a React component that fetches data, displays it, lets the user edit, and updates in real time — they're calling the SDK. When their backend developer writes a script that imports nightly batch data — they're calling the SDK.

The SDK's quality determines whether the platform is "another self-hostable tool" or "the obvious choice for our team." Supabase's market position rests as much on `supabase-js` as on Postgres. Done well, the SDK becomes the primary touchpoint and the primary differentiator.

This objective ships the SDK in TypeScript first; Python and Go are planned follow-ons (their objectives are deferred until customer demand justifies them). Any future language SDK reuses the OpenAPI specs and type definitions generated here.

---

## 2. Scope

### In Scope

- **TypeScript / JavaScript SDK** as the v1 deliverable (`@platform-name/sdk`)
- **Type generation from customer schemas**: per-workspace types fetched at build time or via the platform's CLI
- **Auth client**: sign-in (all flows), sign-up, sign-out, session management, MFA, identity linking, OAuth/OIDC redirects
- **Data client (REST)**: typed CRUD per table; filter/sort/pagination via the same Filter AST; bulk operations
- **Data client (GraphQL)**: GraphQL operations with type generation; integrates with Apollo Client / urql / standalone
- **Realtime client**: subscriptions over WebSocket; reconnection logic; resume; backpressure handling
- **Storage client**: upload (with tus.io for large files), download, signed URLs, file management
- **Query client**: ad-hoc query execution (where the user has `query.read` / `query.write` permission)
- **Cross-runtime support**: browser, Node.js, Deno, Bun, React Native, Cloudflare Workers
- **Framework integrations**: React hooks (`@platform-name/sdk-react`), Vue composables (`@platform-name/sdk-vue`)
- **Error handling**: typed errors mirroring the API's RFC 7807 problem details
- **Retry policy**: exponential backoff on transient errors; configurable per-call
- **Idempotency**: automatic idempotency keys on mutations
- **Caching**: optional in-memory query cache (opt-in; integrates with TanStack Query / SWR)
- **Tree-shakeable**: customers only ship the parts they use; the auth client doesn't bundle the storage client
- **CDN distribution**: also published to a CDN for direct `<script>` use; not just npm
- **Documentation**: TypeDoc-generated API reference; tutorials; example apps
- **CLI tool**: `@platform-name/cli` for type generation, project bootstrap, schema sync
- **Telemetry**: optional anonymous SDK telemetry (off by default; explicit opt-in); helps the platform team understand SDK usage patterns
- ADRs

### Out of Scope (Belongs to Later Objectives)

- Python SDK (deferred until customer demand justifies)
- Go SDK (deferred)
- Rust SDK (deferred)
- Mobile-native SDKs (Swift, Kotlin) — deferred
- A no-code "build apps without code" frontend (separate product)
- Server-side rendering helpers beyond what TanStack Query / SWR provide (deferred)
- Edge Functions / custom server logic (separate objective; the SDK is a client; server-side custom logic is its own thing)
- AI-generated code / scaffolding (covered by the AI build pipeline, not here)

---

## 3. Locked Decisions

| Decision            | Choice                                                                                                                      | Rationale                                       |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Primary language    | TypeScript                                                                                                                  | First class; everything else generated/wraps it |
| Package manager     | npm-published; `@platform-name/sdk`, `@platform-name/sdk-react`, etc.                                                       | Standard                                        |
| Module format       | Dual ESM + CJS; `.d.ts` types                                                                                               | Modern + legacy support                         |
| HTTP client         | `ofetch` or native `fetch` (when available)                                                                                 | Lightweight; cross-runtime                      |
| WebSocket client    | `ws` (Node) + native `WebSocket` (browser); abstracted                                                                      | Cross-runtime                                   |
| Type generation     | OpenAPI 3.1 spec → TS types via `openapi-typescript`; GraphQL → TS via `graphql-codegen`                                    | Industry standard                               |
| Type sync mechanism | CLI command `pdm sync-types` reads platform's per-workspace OpenAPI/GraphQL endpoints; writes to local `.platform/types.ts` | Reproducible; offline-capable                   |
| Builder pattern     | Fluent for queries (`db.users.where(...).orderBy(...).limit(...)`)                                                          | Discoverable; chainable                         |
| Error model         | Typed error subclasses mirroring API errors; `code` and `correlationId` exposed                                             | Programmatic handling                           |
| Result type         | Native promises (not Result<T, E> in the SDK) — TypeScript developers expect this                                           | Familiar; integrates with frameworks            |
| Auth state storage  | Browser: secure cookie (default) or localStorage (configurable); Node: explicit token passing                               | Best per environment                            |
| Token refresh       | Automatic in the background before expiry; configurable                                                                     | Transparent to app code                         |
| Default timeout     | 30 seconds per request                                                                                                      | Same as API                                     |
| Retry policy        | 3 retries on 5xx and network errors; exponential backoff; configurable                                                      | Robust                                          |
| Idempotency         | Auto-generated UUID per mutation; configurable                                                                              | Safe retry                                      |
| Observability       | OTel spans on every SDK call (when `tracing: true`)                                                                         | Tracing across the boundary                     |
| Bundle size target  | Core SDK < 30 KB minified-gzipped; framework integration < 50 KB                                                            | Web-first; bundle matters                       |

---

## 4. Architectural Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                      CUSTOMER'S APPLICATION                            │
│                                                                       │
│   import { createClient } from '@platform-name/sdk';                   │
│   const platform = createClient({ url, anonKey });                     │
│                                                                       │
│   await platform.auth.signIn({ email, password });                     │
│   const { data } = await platform.data('users').where(...);            │
│   const sub = platform.realtime('users').on('insert', handler);        │
│   await platform.storage('avatars').upload(file);                      │
│   const result = await platform.query.execute(sql, params);            │
└────────────────────────────┬────────────────────────────────────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
            ▼                ▼                ▼
   ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
   │ AuthClient     │ │ DataClient      │ │ RealtimeClient │
   │ - sign-in flow │ │ - REST builder  │ │ - WS connect   │
   │ - session mgmt │ │ - GraphQL ops   │ │ - subscribe    │
   │ - MFA          │ │ - bulk ops       │ │ - reconnect    │
   └────────────────┘ └────────────────┘ └────────────────┘
            │                │                │
            └────────────────┼────────────────┘
                             │
                             ▼
                ┌──────────────────────────┐
                │   HTTP / WS Transport     │
                │   - URL building           │
                │   - Auth header injection  │
                │   - Retry policy           │
                │   - Idempotency keys       │
                │   - Tracing                │
                └──────────────────────────┘
                             │
                             ▼
                ┌──────────────────────────┐
                │   The Platform's APIs     │
                │   (REST, GraphQL, WS,     │
                │    Storage, Query)         │
                └──────────────────────────┘
```

The SDK is layered. The bottom is transport plumbing. The middle is per-feature clients. The top is the public surface — `createClient(...)` returns an object with method chains for everything.

---

## 5. The Hard Parts

**5.1 Type generation per workspace**

Each customer's workspace has its own schema. Their TypeScript types should reflect their actual tables and columns, not generic `Record<string, unknown>`. The platform supports this via:

1. **Server-side**: each workspace's OpenAPI 3.1 spec at `/api/v1/data/<workspace>/openapi.json` (Objective 12) and GraphQL schema at the GraphQL endpoint
2. **Client-side**: a CLI command (`pdm sync-types`) that fetches these and writes typed declarations to the customer's project

The flow:

```bash
# In customer's project
pdm sync-types --workspace acme
# Writes types to ./.platform/types.ts
```

The customer imports:

```typescript
import { createClient } from '@platform-name/sdk';
import type { Database } from './.platform/types';

const platform = createClient<Database>({ url, anonKey });

// Fully typed:
const { data } = await platform
  .data('users')
  .select('id', 'email')
  .where({ active: { _eq: true } });
//      ^? data: { id: string, email: string }[]
```

When the schema changes (Objective 11's deploy), the customer re-runs `pdm sync-types` to refresh. The CLI can also watch for changes during development.

**Critical design**: types are **opt-in**, not required. A customer using JavaScript (no TS) or who hasn't run sync-types still gets a working SDK — just with `Record<string, unknown>` types. Types add safety; they're not a barrier to entry.

**5.2 Cross-runtime support**

The SDK must work in:

- Modern browsers (Chrome, Safari, Firefox, Edge)
- Node.js 22+
- Deno
- Bun
- React Native
- Cloudflare Workers / other edge runtimes

Each runtime has subtle differences:

- `fetch`: native in browsers, Node 18+, Deno, Bun, Workers — but with subtle behavioral differences
- `WebSocket`: native in browsers and Workers; `ws` package needed for Node; React Native has its own
- Cookies: browser auto-handles via fetch; other runtimes need explicit headers
- File / Buffer types differ (browser `File`, Node `Buffer`, etc.)
- Timers, intervals: standard but worth verifying

The SDK abstracts these via a small "runtime adapter" layer:

```typescript
// internal: packages/sdk/src/runtime/index.ts
export interface RuntimeAdapter {
  fetch: typeof fetch;
  WebSocket: typeof WebSocket;
  cookieStore?: CookieStore;
  // ... etc
}

export function detectRuntime(): RuntimeAdapter {
  // Uses feature detection, not user-agent parsing
}
```

The build outputs runtime-specific entry points where needed:

- `dist/index.js` — universal (uses native APIs)
- `dist/index.node.js` — Node-specific (uses `ws`, etc.)
- `dist/index.react-native.js` — RN-specific

The customer's bundler picks the right one via `package.json` exports field.

**5.3 The fluent builder for queries**

Users should write:

```typescript
const { data, error, count } = await platform
  .data('posts')
  .select('id', 'title', 'author_id')
  .where({ published: { _eq: true } })
  .orderBy('created_at', 'desc')
  .limit(50);
```

This is implemented as a builder that accumulates state and produces a Promise on `.then()` / `await`:

```typescript
class DataQueryBuilder<T> {
  // State: filter, sort, pagination, fields, etc.

  select<K extends keyof T>(...fields: K[]): DataQueryBuilder<Pick<T, K>>;
  where(filter: Filter<T>): this;
  orderBy(field: keyof T, direction?: 'asc' | 'desc'): this;
  limit(n: number): this;
  offset(n: number): this; // discouraged but supported
  cursor(c: string): this; // preferred pagination

  // Promise-like
  then<TResult>(onFulfilled: (value: { data: T[]; count?: number; error?: AppError }) => TResult): Promise<TResult>;
}
```

The builder's `.then` triggers the actual fetch. Customers can compose builders and execute later, or chain and `await` immediately. Both feel natural.

For mutations:

```typescript
const { data, error } = await platform.data('posts').insert({ title: 'Hello', body: '...' });
const { data, error } = await platform
  .data('posts')
  .where({ id: { _eq: '...' } })
  .update({ title: 'New title' });
const { error } = await platform
  .data('posts')
  .where({ id: { _eq: '...' } })
  .delete();
```

These return promises directly (no chain to extend after the operation specifier).

**5.4 GraphQL alongside REST**

GraphQL users have different ergonomic preferences. The SDK provides:

```typescript
import { gql } from '@platform-name/sdk';

const result = await platform.gql(
  `
  query GetUserPosts($userId: ID!) {
    user(id: $userId) {
      posts(first: 10) {
        edges { node { id title body } }
      }
    }
  }
`,
  { userId: 'abc-123' },
);
```

Plus integrations with popular GraphQL clients (Apollo, urql) that use the platform's auth + transport but plug into the customer's existing GraphQL infrastructure.

For typed queries, the SDK works with `graphql-codegen` — the customer runs codegen against their workspace's GraphQL endpoint; gets typed query functions; calls them via the SDK's transport.

**5.5 Realtime client with reconnection**

The realtime client connects via WebSocket; the connection is stateful and must handle:

- Initial connection with auth
- Reconnection on network failure
- Resume of subscriptions across reconnects (using resume tokens from Objective 14)
- Backpressure (the user might subscribe and never read; bounded buffer in the client)
- Heartbeats
- Clean shutdown

```typescript
const channel = platform.realtime('posts').on('insert', (event) => {
  console.log('New post:', event.new);
});

channel.on('update', handleUpdate).on('delete', handleDelete);

// Filter
channel.filter({ author_id: { _eq: currentUserId } });

// Snapshot mode
channel.snapshot(true).on('snapshot_complete', () => {
  console.log('Current state loaded; now receiving live updates');
});

// Cleanup
channel.unsubscribe();
```

The client maintains exactly one WebSocket per platform connection (multiplexing all channels over it). Connection lifecycle managed automatically; customer doesn't think about it.

Reconnection is automatic with exponential backoff. On reconnect, all active channels resume from their saved positions (within the 5-minute window). After a longer disconnect, the client emits a `reconnect_resync` event so the customer can decide what to do (typically: refetch initial state).

**5.6 Storage client with tus.io**

```typescript
const file = document.querySelector('input[type=file]').files[0];

// Small file (< 5 MB): simple
const result = await platform.storage('avatars').upload(file, {
  filename: 'me.jpg',
  contentType: 'image/jpeg',
});

// Large file (any size): with progress
const upload = platform.storage('videos').upload(file, {
  filename: 'demo.mp4',
  contentType: 'video/mp4',
  resumable: true,
});

upload.on('progress', (e) => {
  console.log(`${e.uploaded} / ${e.total} bytes`);
});

upload.on('completed', (file) => {
  console.log('Uploaded:', file.id);
});

await upload;
```

The storage client integrates a tus client (`tus-js-client` or similar) under the hood; switches between simple and resumable based on file size or explicit `resumable` flag. Resumable uploads survive page refresh (the upload URL is stored in localStorage and resumable on next visit).

For downloads:

```typescript
const url = await platform.storage('avatars').getSignedUrl(fileId, { expiresIn: '1h' });

// Or for direct binary:
const blob = await platform.storage('avatars').download(fileId);
```

**5.7 Auth client with multiple flows**

The auth client supports every flow Objective 5 defines:

```typescript
// Email + password
await platform.auth.signIn({ email, password });

// Magic link
await platform.auth.signInWithMagicLink({ email });

// OAuth (redirects)
platform.auth.signInWithProvider('google');

// MFA challenge
await platform.auth.completeMfaChallenge({ code });

// Sign up
await platform.auth.signUp({ email, password, displayName });

// Sign out
await platform.auth.signOut();

// Get current session
const session = platform.auth.getSession();

// Listen for auth changes
platform.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    /* ... */
  }
  if (event === 'SIGNED_OUT') {
    /* ... */
  }
});
```

Auth state is stored per the configured strategy:

- Browser default: secure HttpOnly cookie (set by the platform's API)
- Browser opt-in: localStorage (less secure but useful for cross-tab sync)
- Node / scripts: in-memory or explicitly-managed token
- React Native: the runtime's secure storage (Keychain / Keystore)

The auth client handles automatic token refresh: monitors session expiry; refreshes silently before the token would expire; emits events on refresh failure (so the app can route to sign-in).

**5.8 Idempotency on mutations**

Every mutation generates an idempotency key automatically (UUID v4):

```typescript
await platform.data('posts').insert({ title: 'Hello' });
// Sends: Idempotency-Key: <auto-generated-uuid>
```

If the request is interrupted (network error mid-flight), the SDK retries with the SAME key. The platform recognizes the duplicate and returns the cached result instead of double-inserting.

For application-controlled idempotency, the customer can pass their own:

```typescript
await platform.data('posts').insert({ title: 'Hello' }, { idempotencyKey: 'order-12345' });
```

Useful for flows like "process payment then create record"; the customer's order ID is the idempotency key, ensuring the create-record step is idempotent across retries even from different SDK invocations.

**5.9 Framework integrations**

`@platform-name/sdk-react` provides hooks:

```typescript
import { useQuery, useMutation, useRealtime } from '@platform-name/sdk-react';

function PostsList() {
  const { data, error, isLoading, refetch } = useQuery(
    platform.data('posts').where({ published: { _eq: true } })
  );

  useRealtime(platform.realtime('posts'), {
    onInsert: (event) => refetch(),
    onUpdate: (event) => refetch(),
  });

  if (isLoading) return <Spinner />;
  if (error) return <Error error={error} />;
  return data.map(post => <Post key={post.id} {...post} />);
}
```

These hooks integrate with TanStack Query under the hood (the platform's query DSL produces TanStack Query keys consistently).

`@platform-name/sdk-vue` — equivalent composables for Vue 3.

**5.10 Tree-shaking**

Customers using only auth shouldn't bundle the storage client. The SDK's package.json exports field allows importing specific clients:

```typescript
// Brings in everything (~30 KB)
import { createClient } from '@platform-name/sdk';

// Brings in only auth
import { createAuthClient } from '@platform-name/sdk/auth';

// Brings in only data
import { createDataClient } from '@platform-name/sdk/data';
```

Each sub-export is independently buildable. The full SDK is constructed by composing these. The bundle analyzer in CI verifies bundle sizes per entry point.

**5.11 Documentation as a deliverable**

A great SDK has great documentation. This objective ships:

- **API reference**: TypeDoc-generated from the source code; covers every public method, type, and option
- **Quickstart guide**: "Get the SDK running in your app in 10 minutes"
- **Tutorials**: 5–10 walkthrough tutorials covering common scenarios:
  - Auth: sign-in, sign-up, password reset, MFA
  - Data: CRUD; filtering; pagination; bulk operations
  - Realtime: live tables; collaborative editing; presence
  - Storage: file uploads; image galleries; signed URL sharing
  - Combined: a full mini-app combining multiple features
- **Example apps**: 3 reference applications in the SDK repo:
  - A "Todo list" classic example
  - A "real-time collaborative document editor" showcasing realtime
  - A "blog with comments" showcasing data + auth + storage + realtime
- **Migration guides**: for customers coming from Supabase, Firebase, etc.

These live in `apps/docs/sdk/` (the platform's documentation site, presumably built with VitePress or similar) and `examples/sdk/` for the example apps.

**5.12 Telemetry — opt-in only**

The SDK can emit anonymous usage telemetry: which methods are called, error rates, runtime/browser versions. Useful for the platform team to understand usage patterns and prioritize improvements.

Strict requirements:

- **Off by default**. Customers explicitly enable it via `createClient({ telemetry: true })`.
- **Anonymous**. No user IDs, no workspace IDs, no data values.
- **Documented exactly**: customer can see what's sent.
- **Auditable**: the source code is open; the customer can verify.

Many customers will never enable it. Some will. Either way, the platform team has zero leverage to push it; the option exists for those who want to help.

---

## 6. Component Specifications

### 6.1 Package Structure

```
packages/sdk/
├── package.json         # @platform-name/sdk
├── src/
│   ├── index.ts          # main entry (createClient)
│   ├── auth/             # auth client
│   ├── data/             # data client (REST + GraphQL builders)
│   ├── realtime/         # realtime client
│   ├── storage/          # storage client
│   ├── query/            # query console client
│   ├── runtime/          # runtime adapters
│   ├── transport/        # HTTP / WS plumbing
│   └── errors/           # typed errors

packages/sdk-react/
├── package.json         # @platform-name/sdk-react
├── src/
│   ├── index.ts
│   ├── useQuery.ts
│   ├── useMutation.ts
│   ├── useRealtime.ts
│   ├── useAuth.ts
│   └── useStorage.ts

packages/sdk-vue/
├── package.json         # @platform-name/sdk-vue
└── src/
    └── ... (composables)

packages/cli/
├── package.json         # @platform-name/cli
└── src/
    ├── commands/
    │   ├── sync-types.ts
    │   ├── init.ts
    │   ├── login.ts
    │   └── ...
    └── index.ts
```

### 6.2 Core Client API

```typescript
// packages/sdk/src/index.ts

export interface CreateClientOptions {
  url: string; // platform installation URL
  anonKey?: string; // anonymous API key for unauthenticated access
  workspace?: string; // workspace slug (defaults to URL or auth-implied)
  schema?: string; // schema slug (often defaults to "main")
  authStorage?: AuthStorageStrategy; // how to persist auth state
  fetch?: typeof fetch; // override fetch for testing
  telemetry?: boolean;
  retry?: RetryOptions;
  timeout?: number;
  trace?: boolean;
}

export interface PlatformClient<TDatabase = any> {
  auth: AuthClient;
  data: <TableName extends keyof TDatabase>(table: TableName) => DataQueryBuilder<TDatabase[TableName]>;
  gql: <TResult, TVars>(query: string, variables?: TVars) => Promise<TResult>;
  realtime: <TableName extends keyof TDatabase>(table: TableName) => RealtimeChannel<TDatabase[TableName]>;
  storage: (bucket: string) => StorageClient;
  query: QueryClient;
  // Configuration
  setWorkspace(workspace: string): PlatformClient<TDatabase>;
  setSchema(schema: string): PlatformClient<TDatabase>;
}

export function createClient<TDatabase = any>(opts: CreateClientOptions): PlatformClient<TDatabase>;
```

### 6.3 Auth Client API

```typescript
export interface AuthClient {
  // Sign-in flows
  signIn(input: SignInInput): Promise<{ session: Session; user: User } | { challenge: AuthChallenge }>;
  signInWithMagicLink(input: { email: string }): Promise<void>;
  signInWithProvider(provider: 'google' | 'github' | 'microsoft' | 'apple' | string, opts?: SignInProviderOptions): Promise<void>;
  signInWithSaml(idpId: string): Promise<void>;

  // MFA
  completeMfaChallenge(input: { code: string }): Promise<{ session: Session; user: User }>;
  enrollMfa(): Promise<MfaEnrollment>;
  confirmMfaEnrollment(code: string): Promise<{ recoveryCodes: string[] }>;
  disableMfa(): Promise<void>;

  // Sign-up
  signUp(input: SignUpInput): Promise<{ user: User; verificationRequired: boolean }>;

  // Verification & reset
  resendEmailVerification(email: string): Promise<void>;
  verifyEmail(token: string): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  resetPassword(token: string, newPassword: string): Promise<void>;

  // Session
  signOut(opts?: { everywhere?: boolean }): Promise<void>;
  getSession(): Session | null;
  refreshSession(): Promise<Session>;
  onAuthStateChange(handler: (event: AuthStateEvent, session: Session | null) => void): Unsubscribe;

  // Account
  updateProfile(input: ProfileUpdate): Promise<User>;
  changePassword(input: { currentPassword: string; newPassword: string }): Promise<void>;
  changeEmail(input: { newEmail: string; password: string }): Promise<void>;
  linkIdentity(provider: string): Promise<void>;
  unlinkIdentity(provider: string): Promise<void>;
  listSessions(): Promise<Session[]>;
  revokeSession(sessionId: string): Promise<void>;

  // Account deletion
  requestAccountDeletion(reason?: string): Promise<{ scheduledFor: Date }>;
  cancelAccountDeletion(): Promise<void>;
}
```

### 6.4 Data Client API

```typescript
export interface DataQueryBuilder<TRow> {
  // Selection
  select<K extends keyof TRow>(...fields: K[]): DataQueryBuilder<Pick<TRow, K>>;

  // Filter
  where(filter: Filter<TRow>): this;

  // Sort
  orderBy(field: keyof TRow, direction?: 'asc' | 'desc'): this;

  // Pagination
  limit(n: number): this;
  cursor(c: string): this;
  offset(n: number): this;

  // Modifiers
  archived(include: 'only' | 'include' | 'exclude'): this;
  withCount(): this;

  // Termination (returns promises)
  then<TResult>(onFulfilled: (value: QueryResult<TRow>) => TResult): Promise<TResult>;

  // Mutations (start a new builder)
  insert(record: Partial<TRow> | Partial<TRow>[]): Promise<MutationResult<TRow>>;
  update(changes: Partial<TRow>): Promise<MutationResult<TRow>>;
  upsert(record: Partial<TRow>, conflict: keyof TRow | (keyof TRow)[]): Promise<MutationResult<TRow>>;
  delete(): Promise<MutationResult<void>>;
  archive(): Promise<MutationResult<void>>;
  restore(): Promise<MutationResult<void>>;
  hardDelete(): Promise<MutationResult<void>>;

  // Single-row helpers
  first(): Promise<TRow | null>;
  one(): Promise<TRow>; // throws if 0 or > 1
  count(): Promise<number>;

  // Bulk
  bulkInsert(records: Partial<TRow>[]): Promise<BulkResult<TRow>>;
  bulkUpdate(changes: Partial<TRow>): Promise<BulkResult<void>>;
  bulkDelete(): Promise<BulkResult<void>>;
}
```

### 6.5 Realtime Client API

```typescript
export interface RealtimeChannel<TRow> {
  // Lifecycle
  on(event: ChangeOperation, handler: (e: RealtimeEvent<TRow>) => void): this;
  filter(filter: Filter<TRow>): this;
  fields(...fields: (keyof TRow)[]): this;
  snapshot(enabled: boolean): this;

  // Connect / disconnect
  subscribe(): Promise<void>;
  unsubscribe(): Promise<void>;

  // State
  status(): 'pending' | 'connected' | 'disconnected' | 'error';
  onStatusChange(handler: (status: ChannelStatus) => void): Unsubscribe;
}

export interface RealtimeEvent<TRow> {
  operation: 'insert' | 'update' | 'delete';
  new: TRow | null;
  old: TRow | null;
  occurredAt: Date;
  position: string;
}
```

### 6.6 Storage Client API

```typescript
export interface StorageClient {
  // Upload
  upload(file: File | Blob | Buffer | ReadableStream, options: UploadOptions): UploadOperation;

  // Download
  download(fileIdOrPath: string): Promise<Blob>;
  getSignedUrl(fileIdOrPath: string, options?: SignedUrlOptions): Promise<string>;

  // Listing
  list(opts?: ListFilesOptions): Promise<PaginatedResult<FileRecord>>;

  // Operations
  rename(fileId: string, newName: string): Promise<FileRecord>;
  move(fileId: string, destination: FileLocation): Promise<FileRecord>;
  copy(fileId: string, destination: FileLocation): Promise<FileRecord>;
  delete(fileId: string): Promise<void>;

  // Folders
  createFolder(path: string): Promise<void>;
  deleteFolder(path: string): Promise<void>;
}

export interface UploadOperation extends Promise<FileRecord> {
  on(event: 'progress' | 'completed' | 'error', handler: (event: any) => void): this;
  abort(): Promise<void>;
  pause(): void;
  resume(): void;
}
```

### 6.7 Query Client API

```typescript
export interface QueryClient {
  execute(sql: string, parameters?: Record<string, unknown>): Promise<QueryResult>;
  explain(sql: string, parameters?: Record<string, unknown>): Promise<QueryPlan>;
  saveQuery(input: SaveQueryInput): Promise<SavedQuery>;
  listSaved(): Promise<SavedQuery[]>;
}
```

### 6.8 React Hooks

```typescript
// packages/sdk-react/src/index.ts

export function useQuery<TRow>(builder: DataQueryBuilder<TRow>, options?: UseQueryOptions): UseQueryResult<TRow[]>;

export function useMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>, options?: UseMutationOptions): UseMutationResult<TArgs, TResult>;

export function useRealtime<TRow>(channel: RealtimeChannel<TRow>, handlers: RealtimeHandlers<TRow>): RealtimeStatus;

export function useAuth(): AuthState & AuthActions;

export function useUpload(): UploadActions;
```

### 6.9 CLI

```bash
pdm init                          # bootstrap a new project
pdm login                         # auth into a platform installation
pdm sync-types --workspace acme    # generate types from a workspace's schema
pdm watch                         # watch for schema changes; resync types
pdm dump-schema --workspace acme   # dump the schema as JSON / YAML
pdm push-schema --workspace acme   # push a local schema definition (for IaC workflows)
```

### 6.10 Build and Distribution

The SDK packages are built using:

- **tsup** for bundling (esbuild-based; fast; produces ESM + CJS + types)
- **Bundle size monitoring** in CI (`bundlewatch` or similar; fails PR if size grows beyond budget)
- **changesets** for versioning and changelog generation
- **GitHub Actions** for publishing to npm on release
- **CDN distribution**: jsDelivr / unpkg for direct `<script>` use

### 6.11 Testing Strategy

The SDK has its own test layers:

- **Unit tests** of each client class against mocked transport
- **Integration tests** against a real platform instance running in Docker (the dev environment)
- **Browser E2E** via Playwright for the auth flows that require redirects
- **Cross-runtime smoke tests**: run a subset of the test suite in Node, Deno, Bun, browser to verify cross-runtime support
- **Bundle size tests** that fail if the budget is exceeded

### 6.12 Observability of the SDK

When `trace: true`, the SDK emits OTel spans via `@opentelemetry/api`:

- One span per public method call
- Spans propagate to the platform via standard OTel context headers
- Attributes include method, status, duration

This is optional; off by default. Customers using OTel get end-to-end traces that span their app and the platform; customers not using OTel pay no cost.

---

## 7. Implementation Order

1. **SDK package skeleton** with tsup build, ESM + CJS + types output verified.

2. **Transport layer** — HTTP client with retry, timeout, idempotency, auth header injection, tracing.

3. **Auth client** — sign-in (password), session storage, refresh, sign-out, onAuthStateChange.

4. **Auth client — extended flows**: magic link, OAuth, SAML, MFA, sign-up, password reset, email verification.

5. **Data client REST builder** — fluent API with select, where, orderBy, limit, cursor; promise-like termination.

6. **Data client mutations** — insert, update, upsert, delete, archive, restore, hardDelete.

7. **Data client bulk operations.**

8. **GraphQL data client** — gql template tag; basic query execution.

9. **Realtime client** — WebSocket connection management, multiplexed channels, subscribe/unsubscribe, reconnection with resume.

10. **Realtime client — backpressure, heartbeats, status events.**

11. **Storage client** — simple upload, download, signed URLs, listing.

12. **Storage client — tus.io resumable uploads** with progress events.

13. **Storage client — folder operations and bulk.**

14. **Query client** — execute, explain, saveQuery, listSaved.

15. **Type generation pipeline** — CLI command, OpenAPI → TS, GraphQL → TS.

16. **CLI tool** — full command set.

17. **Cross-runtime support** — runtime adapter; entry points per runtime; tested in browser, Node, Deno, Bun.

18. **React hooks package** — useQuery, useMutation, useRealtime, useAuth, useUpload.

19. **Vue composables package** (parallel to React).

20. **Bundle size monitoring** in CI.

21. **Telemetry** — opt-in; documented payload.

22. **Documentation site** — TypeDoc reference, tutorials, quickstart.

23. **Example apps** — todo list, collaborative editor, blog.

24. **Cross-platform tests** — verify SDK works against Postgres, MSSQL, Mongo workspaces.

25. **Documentation, runbooks, ADRs.**

26. **Verify Definition of Done.**

---

## 8. ADRs to Write

- **ADR-0144: TypeScript-First SDK** — TS as the source; other languages follow; rationale
- **ADR-0145: Promise-Based Returns, Not Result Type** — TypeScript ergonomics; framework integration
- **ADR-0146: Per-Workspace Type Generation via CLI** — opt-in typing; runtime works without it
- **ADR-0147: Cross-Runtime Support via Runtime Adapter** — feature detection; per-runtime entry points
- **ADR-0148: Tree-Shakeable Sub-Exports** — bundle size discipline
- **ADR-0149: Telemetry Off by Default** — privacy; explicit opt-in
- **ADR-0150: Framework Integrations as Separate Packages** — core SDK runtime-agnostic; React/Vue layers on top

---

## 9. Verification Steps

1. **createClient works** in browser, Node, Deno, Bun, React Native (verified per runtime).

2. **Auth: email + password sign-in** end-to-end against the dev platform.

3. **Auth: OAuth flow** with redirect; back to app; session active.

4. **Auth: MFA challenge** completes correctly.

5. **Auth: session refresh** automatic; transparent to app code.

6. **Auth: onAuthStateChange** fires on sign-in, sign-out, refresh.

7. **Data: simple SELECT** with filter, sort, limit returns correctly typed results.

8. **Data: INSERT** creates a row; returned object reflects server state.

9. **Data: UPDATE with optimistic locking** detects conflict.

10. **Data: bulk insert 1000 rows** completes; per-row results returned.

11. **GraphQL query** executes; results returned typed.

12. **Realtime: subscribe to a table** receives events for inserts, updates, deletes.

13. **Realtime: reconnection** after network failure resumes subscriptions.

14. **Realtime: multiplexing** — 10 channels share one WebSocket connection.

15. **Storage: simple upload** of a 1 MB image succeeds; file_record returned.

16. **Storage: resumable upload** of a 100 MB video; progress events fire; completes.

17. **Storage: download via signed URL** retrieves the file.

18. **Query: execute a SELECT** returns expected rows.

19. **Query: write attempt without `query.write`** fails with clear permission error.

20. **CLI: sync-types** generates types from a workspace; types compile in customer project.

21. **CLI: init** scaffolds a new project; runs successfully.

22. **React hooks: useQuery** fetches data; useRealtime updates on events.

23. **Vue composables**: equivalent to React; tested.

24. **Bundle size**: core SDK < 30 KB minified-gzipped; React integration < 50 KB.

25. **Tree-shaking**: importing only `auth` doesn't include `storage` in the bundle.

26. **Cross-database**: SDK works equivalently on Postgres-backed, MSSQL-backed, Mongo-backed workspaces.

27. **Idempotency**: a mutation retried with the same key returns the cached result.

28. **Errors**: typed error subclasses received correctly; `code` and `correlationId` accessible.

29. **Telemetry**: off by default; opt-in turns it on; documented payload sent only when enabled.

30. **Documentation**: TypeDoc API reference complete; tutorials cover the common scenarios; example apps run.

If all 30 pass, the objective is met.

---

## 10. Definition of Done

**Core SDK**

- [ ] `@platform-name/sdk` package published
- [ ] All clients (auth, data, realtime, storage, query) implemented
- [ ] Cross-runtime support verified (browser, Node, Deno, Bun, React Native, Workers)
- [ ] Tree-shakeable sub-exports
- [ ] Bundle size within budget

**Type Generation**

- [ ] CLI `sync-types` command working
- [ ] OpenAPI → TS pipeline
- [ ] GraphQL → TS pipeline
- [ ] Generated types compile and provide accurate inference

**CLI**

- [ ] `@platform-name/cli` package published
- [ ] Commands: init, login, sync-types, watch, dump-schema, push-schema
- [ ] Cross-platform (Linux, macOS, Windows)

**Framework Integrations**

- [ ] `@platform-name/sdk-react` published
- [ ] `@platform-name/sdk-vue` published
- [ ] Both integrate with TanStack Query (or equivalent caching layer)
- [ ] Hooks/composables for: query, mutation, realtime, auth, upload

**Auth**

- [ ] All sign-in flows: password, magic link, OAuth (Google/GitHub/Microsoft/Apple), OIDC, SAML
- [ ] Sign-up with email verification
- [ ] MFA enrollment + challenge + recovery codes
- [ ] Password reset
- [ ] Identity linking
- [ ] Session refresh + revocation
- [ ] Auth state persistence (cookie, localStorage, in-memory, secure storage)

**Data**

- [ ] Fluent REST builder with select, where, orderBy, limit, cursor, etc.
- [ ] Insert, update, upsert, delete, archive, restore, hardDelete
- [ ] Bulk operations
- [ ] GraphQL via `gql` template tag

**Realtime**

- [ ] WebSocket connection with multiplexing
- [ ] Subscribe per table with filter, fields, operations, snapshot
- [ ] Reconnection with resume
- [ ] Backpressure handling

**Storage**

- [ ] Simple upload (< 5 MB)
- [ ] Resumable upload via tus.io (any size)
- [ ] Download + signed URL
- [ ] Listing, rename, move, copy, delete
- [ ] Progress events on uploads

**Query**

- [ ] Execute, explain, saveQuery, listSaved

**Errors & Reliability**

- [ ] Typed error hierarchy
- [ ] Automatic retry with exponential backoff
- [ ] Idempotency keys on mutations
- [ ] Configurable timeout per call

**Observability**

- [ ] OTel tracing (opt-in)
- [ ] Telemetry (opt-in, anonymous, documented)

**Documentation**

- [ ] TypeDoc API reference
- [ ] Quickstart guide
- [ ] 5+ tutorials
- [ ] 3 example apps
- [ ] Migration guide from Supabase

**Testing**

- [ ] Unit tests with mocked transport
- [ ] Integration tests against dev platform
- [ ] Browser E2E for redirect flows
- [ ] Cross-runtime smoke tests
- [ ] Bundle size in CI
- [ ] All 30 verification steps from Section 9 pass

**ADRs**

- [ ] ADRs 0144–0150 written and Accepted

---

## 11. Anti-Patterns to Refuse

- **Generating per-workspace TypeScript types and shipping them to all customers.** Types are opt-in per project; the SDK works without them.
- **Bundling all clients into one entry point with no tree-shaking.** Sub-exports per client; imports are intentional.
- **Forcing customers to use a specific framework.** The core SDK is framework-agnostic. React and Vue are extras.
- **Blocking the auth UI during background token refresh.** Refresh is silent; no UI flicker.
- **Leaking server-internal IDs (correlationIds, internal request IDs) in error messages but not making them programmatically accessible.** Errors expose `correlationId` so customers can include it in support requests.
- **Telemetry on by default.** Privacy-respecting; opt-in only.
- **Auto-generating idempotency keys for non-idempotent operations like sign-up.** Idempotency on mutations only where it makes sense.
- **Stale type definitions silently accepted.** The CLI's `sync-types` is fast; running it pre-build is the discipline; CI verifies types match the workspace's current schema.
- **Bundling Node-specific code (like `ws`) into the browser build.** Per-runtime entry points prevent this.
- **Silent fallback to less-secure auth storage.** If localStorage is configured, it's explicit; the SDK never silently downgrades cookie-based to localStorage.
- **Pushing breaking changes in minor versions.** SemVer is religious; breaking goes to major; deprecation warnings precede major releases.
- **Bundle size growth without justification.** Bundle budget is in CI; growth requires explanation in the PR.

---

## 12. Open Questions for Confirmation Before Starting

1. **Package naming** — `@platform-name/sdk` is a placeholder; the actual name depends on the product's branding. Confirmed?

2. **TypeScript-first vs. universal-JavaScript-first** — TS is the source; JS users get the compiled output with type definitions. Acceptable?

3. **Bundle size budget** — proposing 30 KB minified-gzipped for core. Industry-similar SDKs (Supabase JS, Firebase modular) range 20-100 KB. Recommendation: 30 KB target; bigger if it brings real value; CI tracks growth.

4. **Result type vs. Promise** — proposing native promises (resolved value or thrown error). Some teams prefer `Result<T, E>` for explicit error handling. Recommendation: promises; it matches TypeScript ecosystem expectations and integrates with framework patterns.

5. **Telemetry opt-in vs. opt-out** — proposing opt-in. Some platforms default opt-out (collect by default; respect explicit opt-out). Recommendation: opt-in (explicit and respectful).

6. **Cross-runtime testing depth** — proposing CI runs full test suite on Node + a subset on browser/Deno/Bun. Recommendation: yes, with browser via Playwright for auth flows; Deno/Bun smoke tests; React Native verified via example app.

7. **Python SDK timing** — proposing deferred until customer demand. Some sales conversations might require Python earlier. Recommendation: TypeScript ships first; Python is a clear follow-up objective when a customer demands it; OpenAPI specs make the Python work tractable.

8. **CDN distribution** — confirmed publishing to jsDelivr / unpkg for direct `<script>` use? Or npm-only? Recommendation: both — CDN enables prototyping without a build step.

9. **Versioning strategy** — proposing changesets + SemVer. Major versions are rare and deliberate; deprecation warnings precede breaking changes. Confirmed?

---

## 13. What Comes Next

With Objective 19 complete, **the Data Management Module is a complete, sellable product**. A customer can:

- Install the platform on Linux or Windows
- Point it at Postgres, MSSQL, or MongoDB
- Define schemas in the visual designer
- Get auto-generated REST and GraphQL APIs
- Subscribe to real-time events
- Manage files via the storage layer
- Configure auth with their preferred IdP (built-in, Entra, OIDC, SAML)
- Browse and edit data in a polished UI
- Run ad-hoc queries with safety rails
- Build their applications using the SDK

This is a full Supabase competitor. It works on databases Supabase doesn't. It runs on infrastructure Supabase doesn't. It costs whatever the customer's hosting costs (no per-row pricing, no MAU charges). It's open source under AGPL-3.0; the customer owns their data and their deployment.

The platform is now **ready to ship**.

---

## Looking Forward: The AI Build Pipeline

The Data Management Module is the simpler half of the platform's vision. The harder half — the AI Build Pipeline (Stages 1 through 10) — runs in parallel after Objective 10's quality gate passes.

The AI Build Pipeline turns the foundation into a different kind of product:

- **Stage 1: Intent Capture** — natural-language conversations producing structured intent briefs
- **Stage 2: Requirements (PRD)** — AI-assisted PRD generation from intents, with reasoning attached and human approval gates
- **Stage 3: Design Tokens** — visual design language derived from the brand and the PRD
- **Stage 4: Schema** — schema synthesis (which uses Objective 11's Schema Designer as its surface)
- **Stage 5: Data Migration** — handling existing-data scenarios
- **Stage 6: UI Generation** — components built from design tokens and schema
- **Stage 7: Code Generation** — server-side logic, integrations
- **Stage 8: Test Generation** — comprehensive test suites
- **Stage 9: Deployment** — deploy through the configured environments (Objective 2)
- **Stage 10: Maintenance** — feedback loops, regeneration, evolution

Each AI pipeline stage is its own objective. Each follows the canonical service pattern from Objective 8. Each integrates with the configurable approval routing from Objective 6 — solo workflows let the developer approve everything; enterprise workflows route to BAs, designers, architects, QA, ops in their proper sequence.

The AI Build Pipeline is what differentiates the platform from "yet another self-hostable BaaS." The Data Management Module gives customers Supabase parity; the AI Build Pipeline gives them something Supabase doesn't have. Together, they're the platform's value proposition.

---

_This document is the contract. Every checkbox in Section 10 must be true before declaring the Data Management Module complete and ready for customers._
