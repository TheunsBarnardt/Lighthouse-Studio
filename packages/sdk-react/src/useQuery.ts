import type { DataQueryBuilder, QueryResult } from '@platform/sdk';

import { useQuery as useTanstackQuery } from '@tanstack/react-query';

export interface UseQueryOptions {
  enabled?: boolean | undefined;
  staleTime?: number | undefined;
  refetchInterval?: number | false | undefined;
  queryKey?: unknown[] | undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useQuery<TRow = any>(builder: DataQueryBuilder<TRow>, options?: UseQueryOptions) {
  const queryKey = options?.queryKey ?? [
    '__platform__',
    JSON.stringify((builder as unknown as { state: unknown }).state),
  ];

  return useTanstackQuery<TRow[]>({
    queryKey,
    queryFn: async (): Promise<TRow[]> => {
      const result: QueryResult<TRow> = await builder;
      return result.data;
    },
    ...(options?.enabled !== undefined ? { enabled: options.enabled } : {}),
    ...(options?.staleTime !== undefined ? { staleTime: options.staleTime } : {}),
    ...(options?.refetchInterval !== undefined ? { refetchInterval: options.refetchInterval } : {}),
  });
}
