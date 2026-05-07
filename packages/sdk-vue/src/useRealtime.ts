import type { RealtimeChannel, RealtimeEvent, ChangeOperation } from '@platform/sdk';

import { ref, onMounted, onUnmounted, type Ref } from 'vue';

export type RealtimeHandlers<TRow> = {
  onInsert?: (event: RealtimeEvent<TRow>) => void;
  onUpdate?: (event: RealtimeEvent<TRow>) => void;
  onDelete?: (event: RealtimeEvent<TRow>) => void;
};

export function useRealtime<TRow>(
  channel: RealtimeChannel<TRow>,
  handlers: RealtimeHandlers<TRow>,
): { status: Ref<string> } {
  const status = ref<string>('pending');

  onMounted(() => {
    const ops: ChangeOperation[] = ['insert', 'update', 'delete'];
    for (const op of ops) {
      channel.on(op, (event: RealtimeEvent<TRow>) => {
        if (op === 'insert') handlers.onInsert?.(event);
        else if (op === 'update') handlers.onUpdate?.(event);
        else handlers.onDelete?.(event);
      });
    }
    const unsubStatus = channel.onStatusChange((s) => {
      status.value = s;
    });
    void channel.subscribe();

    onUnmounted(() => {
      unsubStatus();
      void channel.unsubscribe();
    });
  });

  return { status };
}
