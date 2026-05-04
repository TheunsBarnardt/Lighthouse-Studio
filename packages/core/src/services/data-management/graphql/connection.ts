// ── Relay-style cursor connection builder ──────────────────────────────────────
//
// Produces the standard { edges, pageInfo, totalCount? } shape expected by
// Relay-compliant clients. The cursor is a base64url-encoded JSON object
// containing the primary key value of the last-seen row.

export interface Connection<T> {
  edges: Array<{ node: T; cursor: string }>;
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
  };
  totalCount?: number;
}

/** Encode a primary key value into an opaque cursor string. */
export function encodeCursor(pkColumn: string, pkValue: unknown): string {
  const json = JSON.stringify({ col: pkColumn, val: String(pkValue) });
  return Buffer.from(json).toString('base64url');
}

/** Decode a cursor back to its primary key value; returns null on malformed input. */
export function decodeCursor(cursor: string): { col: string; val: string } | null {
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return null;
    const obj = parsed as Record<string, unknown>;
    if (typeof obj['col'] !== 'string' || typeof obj['val'] !== 'string') return null;
    return { col: obj['col'], val: obj['val'] };
  } catch {
    return null;
  }
}

/**
 * Wrap a list of fetched rows in a Relay Connection structure.
 *
 * @param rows - The rows to wrap (already sliced to the requested page size).
 * @param pkColumn - The primary key column name (snake_case, as stored in DB).
 * @param hasNextPage - Whether there are more rows after this page.
 * @param afterCursor - The cursor that was passed in the `after` arg (for hasPreviousPage).
 * @param totalCount - Optional pre-fetched total count.
 */
export function makeConnection<T extends Record<string, unknown>>(
  rows: T[],
  pkColumn: string,
  hasNextPage: boolean,
  afterCursor: string | undefined,
  totalCount?: number,
): Connection<T> {
  const edges = rows.map((row) => ({
    node: row,
    cursor: encodeCursor(pkColumn, row[pkColumn]),
  }));

  const startCursor = edges[0]?.cursor ?? null;
  const endCursor = edges[edges.length - 1]?.cursor ?? null;
  const hasPreviousPage = afterCursor !== undefined;

  return {
    edges,
    pageInfo: {
      hasNextPage,
      hasPreviousPage,
      startCursor,
      endCursor,
    },
    ...(totalCount !== undefined ? { totalCount } : {}),
  };
}
