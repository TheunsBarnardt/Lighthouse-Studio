# Contract: Search Ports

## Purpose

Provides three complementary search abstractions:

- **`FullTextSearchPort`** — keyword-based document indexing and retrieval.
  Used for the Data Browser search bar, workspace-level content search, and
  any feature that needs ranked text matching.
- **`VectorStorePort`** — vector similarity search over dense embeddings. Used
  for AI-powered semantic search, RAG retrieval, and similar-record suggestions.
- **`EmbeddingPort`** — text-to-vector conversion. Converts user queries and
  stored documents into numeric vectors for use with `VectorStorePort`.

All three are defined in `@platform/ports-search`. `VectorStorePort` and
`EmbeddingPort` are nullable in the container; they are only required when AI
features are enabled.

---

## Methods

### FullTextSearchPort

#### index(doc: SearchDocument): Promise<Result<void, SearchError>>

Adds or replaces a document in the search index.

```typescript
interface SearchDocument {
  id: string;
  indexName: string;
  content: Record<string, unknown>; // Indexed fields; values must be serializable
  metadata?: Record<string, unknown>; // Stored but not indexed (adapter-dependent)
}
```

**Pre-conditions:**

- `id` must be unique within `indexName`. Re-indexing an existing `id` replaces
  the document.
- `content` values that are not strings will be coerced to strings by most
  adapters; do not rely on type preservation for content fields.
- `indexName` must be a valid identifier (alphanumeric, hyphens, underscores).

**Post-conditions:**

- On `ok(void)`: the document is indexed and will appear in subsequent searches.
  Indexing may be asynchronous on some adapters (Postgres tsvector triggers); a
  brief lag before the document is retrievable is acceptable.
- On `err(SearchError)`: the document was not indexed.

---

#### search(query: string, opts?: SearchOptions): Promise<Result<SearchResult[], SearchError>>

Executes a full-text query.

```typescript
interface SearchOptions {
  indexName?: string; // Scope to one index; omit to search all
  limit?: number; // Default: 20; maximum: adapter-dependent
  offset?: number; // For pagination
  filters?: Record<string, unknown>; // Exact-match filters on metadata fields
}

interface SearchResult {
  id: string;
  score: number; // Relevance score; higher is more relevant
  document: SearchDocument;
}
```

**Pre-conditions:**

- `query` must be a non-empty string.
- `filters` keys must correspond to fields the adapter indexes; unknown keys are
  silently ignored by some adapters.

**Post-conditions:**

- On `ok(results)`: results are ordered by descending `score`. An empty array
  means no matches, not an error.
- On `err(SearchError)`: query failed. `INDEX_NOT_FOUND` is returned if
  `indexName` was specified and does not exist.

---

#### delete(id: string): Promise<Result<void, SearchError>>

Removes a single document from all indexes.

**Pre-conditions:** `id` must be non-empty.

**Post-conditions:** On `ok(void)`: document is removed. If `id` does not exist,
returns `ok(void)` (idempotent).

---

#### deleteByIndex(indexName: string): Promise<Result<void, SearchError>>

Drops all documents belonging to an index.

**Pre-conditions:** `indexName` must be non-empty.

**Post-conditions:** On `ok(void)`: all documents in the index are removed. If
the index does not exist, returns `ok(void)` (idempotent). This is a destructive
operation; confirm before calling in response to user action.

---

### VectorStorePort

#### upsert(record: VectorRecord): Promise<Result<void, SearchError>>

Inserts or replaces a vector record.

```typescript
interface VectorRecord {
  id: string;
  vector: number[];
  metadata?: Record<string, unknown>;
  namespace?: string; // Logical partition; adapter-dependent
}
```

**Pre-conditions:**

- `vector` must be non-empty and have the same dimensionality as all other
  vectors in the namespace. Mixing dimensions causes `QUERY_FAILED` or silent
  incorrect results depending on the adapter.
- `metadata` must be JSON-serializable.

**Post-conditions:**

- On `ok(void)`: record is stored and queryable.

---

#### query(vector: number[], opts: VectorQueryOptions): Promise<Result<VectorResult[], SearchError>>

Retrieves the top-K most similar vectors.

```typescript
interface VectorQueryOptions {
  topK: number;
  namespace?: string;
  filter?: Record<string, unknown>; // Metadata pre-filter; adapter-dependent
  includeMetadata?: boolean; // Default: true
}

interface VectorResult {
  id: string;
  score: number; // Cosine similarity or equivalent; higher is more similar
  metadata?: Record<string, unknown>;
}
```

**Pre-conditions:**

- `vector` dimensionality must match the stored vectors.
- `topK` must be >= 1.

**Post-conditions:**

- On `ok(results)`: results ordered by descending similarity score. Length may
  be less than `topK` if fewer records exist.

---

#### delete(id: string): Promise<Result<void, SearchError>>

Removes a vector record by ID.

**Pre-conditions:** `id` must be non-empty.

**Post-conditions:** Idempotent; returns `ok(void)` if the ID does not exist.

---

### EmbeddingPort

#### embed(text: string): Promise<Result<number[], SearchError>>

Converts a single text string into a dense vector.

**Pre-conditions:**

- `text` must be non-empty.
- Text exceeding the model's token limit will be truncated by most adapters.
  Callers responsible for chunking should chunk before calling.

**Post-conditions:**

- On `ok(vector)`: vector has fixed dimensionality determined by the configured
  model. All calls with the same model will produce vectors of the same length.
- On `err(SearchError)`: embedding failed (typically `QUERY_FAILED` for provider
  errors or `RATE_LIMITED` if surfaced through this error type).

---

#### embedMany(texts: string[]): Promise<Result<number[][], SearchError>>

Batch-converts multiple texts into vectors.

**Pre-conditions:**

- `texts` must be non-empty.
- All elements must be non-empty strings.

**Post-conditions:**

- On `ok(vectors)`: `vectors[i]` corresponds to `texts[i]`. All vectors have the
  same dimensionality.
- On `err(SearchError)`: the entire batch failed; partial results are not
  returned.

---

## Error Codes

```typescript
type SearchErrorCode =
  | 'INDEX_NOT_FOUND' // Named index does not exist
  | 'QUERY_FAILED' // Query execution error (malformed query, provider error)
  | 'UNKNOWN';
```

---

## Capability Flags

None are formally defined on these ports. Capabilities are determined by which
adapter is registered and documented below.

### FullTextSearchPort — adapter comparison

| Adapter            | Ranked scoring            | Metadata filters  | Phrase search  |
| ------------------ | ------------------------- | ----------------- | -------------- |
| Postgres tsvector  | Yes (ts_rank)             | Partial (via SQL) | Yes            |
| MSSQL full-text    | Yes (RANK)                | Partial (via SQL) | Yes            |
| MongoDB text index | Yes (textScore)           | No                | Partial        |
| In-memory          | No (order not guaranteed) | No                | Substring only |

### VectorStorePort — adapter comparison

| Adapter         | Namespaces | Metadata filter | Max dimensions |
| --------------- | ---------- | --------------- | -------------- |
| pgvector        | No         | Partial (WHERE) | 2000           |
| Qdrant          | Yes        | Full            | Unlimited      |
| Azure AI Search | Yes        | Full            | 3072           |

### EmbeddingPort — adapter comparison

| Adapter                       | Dimensions      | Notes                           |
| ----------------------------- | --------------- | ------------------------------- |
| OpenAI text-embedding-3-small | 1536            | Default                         |
| OpenAI text-embedding-3-large | 3072            | Higher quality, higher cost     |
| Azure OpenAI                  | Model-dependent | Same models, different endpoint |
| sentence-transformers (local) | Model-dependent | No external API; higher latency |

---

## Performance Expectations

- `FullTextSearch.search`: < 100 ms for indexes under 1 M documents on Postgres
  and MSSQL. MongoDB text search may be slower on large collections without
  compound indexes.
- `VectorStore.query`: < 50 ms for Qdrant with 1 M vectors. pgvector performance
  degrades past ~100 K vectors without HNSW index configuration.
- `EmbeddingPort.embed`: 100–500 ms for remote providers under normal load.
  `embedMany` is significantly more efficient than calling `embed` in a loop;
  prefer it for batches of >= 5 texts.
- `VectorStorePort` and `EmbeddingPort` are nullable. If not registered, calls
  must not be made; the container returns `null` for these ports when AI features
  are disabled.

---

## Known Adapter Divergences

### In-memory FullTextSearch

- Matching is case-insensitive substring matching, not ranked full-text. Scores
  are always `1.0` for a match, `0.0` for no match.
- `metadata` filters are not applied; all documents matching the query string are
  returned regardless of metadata.
- Suitable for unit tests only. Do not use to validate search relevance.

### pgvector

- Requires the `vector` extension to be installed in the database.
- Does not support namespaces; all vectors share one table. Use a metadata field
  to partition logically.
- HNSW index must be created manually for approximate nearest-neighbor search
  at scale; exact KNN (sequential scan) is used by default, which is O(n).

### MongoDB text index

- Only one text index per collection is allowed. Collections that need multiple
  indexed fields must use a compound text index.
- Phrase search support is limited; MongoDB matches individual terms, not exact
  phrases, in the `$text` operator.
- `metadata` filtering requires a compound index; ad-hoc filters cause collection
  scans.

### MSSQL full-text catalogs

- Full-text catalogs must be created and populated before indexing. Schema
  changes that add indexed columns require catalog rebuild.
- The first `index` call for a new catalog may trigger a background population;
  documents are not immediately queryable.

---

## Usage Examples

```typescript
// Indexing a record for search
await fullText.index({
  id: `record:${record.id}`,
  indexName: `workspace:${ctx.workspaceId}:records`,
  content: { name: record.name, description: record.description },
  metadata: { workspaceId: ctx.workspaceId, tableId: record.tableId },
});

// Searching
const results = await fullText.search('invoice unpaid', {
  indexName: `workspace:${ctx.workspaceId}:records`,
  limit: 10,
});
if (results.isErr()) return err(results.error);
const hits = results.value; // SearchResult[]

// Semantic search via embeddings + vector store
const queryVecResult = await embeddings.embed(userQuery);
if (queryVecResult.isErr()) return err(queryVecResult.error);

const similar = await vectorStore.query(queryVecResult.value, {
  topK: 5,
  namespace: `workspace:${ctx.workspaceId}`,
  includeMetadata: true,
});
if (similar.isErr()) return err(similar.error);
```

---

## Common Misuse

**Assuming in-memory and production adapters behave the same.** The in-memory
adapter uses substring matching without ranking. Tests that assert on result
ordering or relevance are not meaningful against the in-memory adapter.

**Mixing vector dimensions.** Storing vectors from two different embedding models
in the same namespace and querying across them produces meaningless similarity
scores. One namespace, one model.

**Calling `embed` in a tight loop.** `embed` makes a remote API call per
invocation. For batches, always use `embedMany`.

**Not scoping `indexName` to a workspace.** Full-text indexes are global to the
adapter. An `indexName` that does not include a workspace identifier will mix
records from different workspaces. Convention: `workspace:{id}:{entity}`.

**Using `deleteByIndex` casually.** This is a bulk destructive operation. The
Data Browser "remove table" flow uses it; ad-hoc use in other code paths should
require explicit confirmation.

**Resolving VectorStorePort without checking for null.** The port is not
registered unless AI features are configured. Guard with a null check before
calling any method.
