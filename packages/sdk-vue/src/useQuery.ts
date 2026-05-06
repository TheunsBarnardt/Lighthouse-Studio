import type { DataQueryBuilder, QueryResult } from '@platform/sdk';
import type { UseQueryReturnType } from '@tanstack/vue-query';
import type { MaybeRefOrGetter } from 'vue';

import { useQuery as useTanstackQuery } from '@tanstack/vue-query';
import { toValue } from 'vue';

export interface UseQueryOptions {
  enabled?: MaybeRefOrGetter<boolean> | undefined;
  staleTime?: number | undefined;
  refetchInterval?: number | false | undefined;
  queryKey?: unknown[] | undefined;
}

export type UseQueryResult<TRow> = UseQueryReturnType<TRow[], Error>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useQuery<TRow = any>(
  builder: MaybeRefOrGetter<DataQueryBuilder<TRow>>,
  options?: UseQueryOptions,
): UseQueryResult<TRow> {
  const queryKey = options?.queryKey ?? [
    '__platform__',
    () => JSON.stringify((toValue(builder) as unknown as { state: unknown }).state),
  ];

  return useTanstackQuery<TRow[]>({
    queryKey,
    queryFn: async (): Promise<TRow[]> => {
      const result: QueryResult<TRow> = await toValue(builder);
      return result.data;
    },
    ...(options?.enabled !== undefined ? { enabled: options.enabled } : {}),
    ...(options?.staleTime !== undefined ? { staleTime: options.staleTime } : {}),
    ...(options?.refetchInterval !== undefined ? { refetchInterval: options.refetchInterval } : {}),
  });
}
