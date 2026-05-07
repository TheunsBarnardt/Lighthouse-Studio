/**
 * In-memory stores for SDK E2E routes (data, storage).
 * Uses globalThis so state survives Next.js hot module replacement.
 */

export interface DataRow {
  id: string;
  version: number;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface StoredFile {
  id: string;
  path: string;
  bucket: string;
  workspace: string;
  size: number;
  contentType: string;
  filename: string;
  data: Buffer;
  createdAt: string;
}

export interface ResumableSession {
  uploadId: string;
  filename: string;
  contentType: string;
  size: number;
  chunks: Buffer[];
  workspace: string;
  bucket: string;
}

export interface SignedToken {
  fileId: string;
  workspace: string;
  bucket: string;
  expiresAt: Date;
}

type TableStore = Map<string, DataRow>; // rowId → row
type SchemaStore = Map<string, TableStore>; // tableName → rows
type WorkspaceDataStore = Map<string, SchemaStore>; // schema → tables

const g = globalThis as typeof globalThis & {
  _sdkDataStore?: WorkspaceDataStore;
  _sdkFileStore?: Map<string, StoredFile>; // `${ws}/${bucket}/${path}` → file
  _sdkResumable?: Map<string, ResumableSession>; // uploadId → session
  _sdkTokens?: Map<string, SignedToken>; // token → metadata
};

// ── Data store ────────────────────────────────────────────────────────────────

function getDataStore(): WorkspaceDataStore {
  if (!g._sdkDataStore) g._sdkDataStore = new Map();
  return g._sdkDataStore;
}

export function getTable(workspace: string, schema: string, table: string): TableStore {
  const ds = getDataStore();
  const wsKey = `${workspace}/${schema}`;
  let schemaStore = ds.get(wsKey);
  if (!schemaStore) {
    schemaStore = new Map();
    ds.set(wsKey, schemaStore);
  }
  let tableStore = schemaStore.get(table);
  if (!tableStore) {
    tableStore = new Map();
    schemaStore.set(table, tableStore);
  }
  return tableStore;
}

/** Apply a filter object `{ field: { _eq: val }, ... }` to rows. */
export function applyFilter(
  rows: DataRow[],
  filter: Record<string, unknown> | undefined,
): DataRow[] {
  if (!filter || Object.keys(filter).length === 0) return rows;
  return rows.filter((row) => {
    for (const [field, cond] of Object.entries(filter)) {
      if (cond === null || typeof cond !== 'object') {
        if (row[field] !== cond) return false;
        continue;
      }
      const ops = cond as Record<string, unknown>;
      if ('_eq' in ops && row[field] !== ops['_eq']) return false;
      if ('_neq' in ops && row[field] === ops['_neq']) return false;
      if ('_gt' in ops && !((row[field] as number) > (ops['_gt'] as number))) return false;
      if ('_gte' in ops && !((row[field] as number) >= (ops['_gte'] as number))) return false;
      if ('_lt' in ops && !((row[field] as number) < (ops['_lt'] as number))) return false;
      if ('_lte' in ops && !((row[field] as number) <= (ops['_lte'] as number))) return false;
      if ('_in' in ops && !(ops['_in'] as unknown[]).includes(row[field])) return false;
    }
    return true;
  });
}

// ── File store ────────────────────────────────────────────────────────────────

function getFileStore(): Map<string, StoredFile> {
  if (!g._sdkFileStore) g._sdkFileStore = new Map();
  return g._sdkFileStore;
}

export function storeFile(
  ws: string,
  bucket: string,
  path: string,
  file: Omit<StoredFile, 'id'>,
): StoredFile {
  const key = `${ws}/${bucket}/${path}`;
  const stored = { ...file, id: key };
  getFileStore().set(key, stored);
  return stored;
}

export function getFile(ws: string, bucket: string, path: string): StoredFile | undefined {
  return getFileStore().get(`${ws}/${bucket}/${path}`);
}

export function deleteFile(ws: string, bucket: string, path: string): boolean {
  return getFileStore().delete(`${ws}/${bucket}/${path}`);
}

// ── Resumable sessions ────────────────────────────────────────────────────────

function getResumableStore(): Map<string, ResumableSession> {
  if (!g._sdkResumable) g._sdkResumable = new Map();
  return g._sdkResumable;
}

export function createResumableSession(session: ResumableSession): void {
  getResumableStore().set(session.uploadId, session);
}

export function getResumableSession(uploadId: string): ResumableSession | undefined {
  return getResumableStore().get(uploadId);
}

export function appendChunk(uploadId: string, chunk: Buffer): void {
  const s = getResumableStore().get(uploadId);
  if (s) s.chunks.push(chunk);
}

export function finalizeResumable(uploadId: string): ResumableSession | undefined {
  const s = getResumableStore().get(uploadId);
  getResumableStore().delete(uploadId);
  return s;
}

// ── Signed tokens ─────────────────────────────────────────────────────────────

function getTokenStore(): Map<string, SignedToken> {
  if (!g._sdkTokens) g._sdkTokens = new Map();
  return g._sdkTokens;
}

export function createSignedToken(token: string, meta: SignedToken): void {
  getTokenStore().set(token, meta);
}

export function resolveSignedToken(token: string): SignedToken | undefined {
  const t = getTokenStore().get(token);
  if (!t) return undefined;
  if (t.expiresAt < new Date()) {
    getTokenStore().delete(token);
    return undefined;
  }
  return t;
}
