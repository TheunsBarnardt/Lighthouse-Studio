import { ResultAsync as _ResultAsync } from 'neverthrow';

export { type Err, type Ok, Result, ResultAsync, err, ok } from 'neverthrow';

/**
 * Wraps a promise that may throw into a ResultAsync.
 * Use at integration boundaries where throwing is unavoidable (e.g. third-party libs).
 */
export function safeAsync<T, E = Error>(
  promise: Promise<T>,
  errorMapper?: (e: unknown) => E,
): _ResultAsync<T, E> {
  return _ResultAsync.fromPromise(
    promise,
    errorMapper ?? ((e) => (e instanceof Error ? e : new Error(String(e))) as unknown as E),
  );
}
