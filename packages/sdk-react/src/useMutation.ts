import type { UseMutationResult as TanstackResult } from '@tanstack/react-query';

import { useMutation as useTanstackMutation } from '@tanstack/react-query';

export interface UseMutationOptions<TArgs, TResult> {
  onSuccess?: ((result: TResult, args: TArgs) => void) | undefined;
  onError?: ((error: Error, args: TArgs) => void) | undefined;
}

export type UseMutationResult<TArgs, TResult> = TanstackResult<TResult, Error, TArgs>;

export function useMutation<TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult>,
  options?: UseMutationOptions<TArgs, TResult>,
): UseMutationResult<TArgs, TResult> {
  return useTanstackMutation<TResult, Error, TArgs>({
    mutationFn: fn,
    ...(options?.onSuccess !== undefined ? { onSuccess: options.onSuccess as never } : {}),
    ...(options?.onError !== undefined ? { onError: options.onError as never } : {}),
  });
}
