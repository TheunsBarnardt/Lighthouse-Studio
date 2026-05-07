import type { RealtimeChannel, RealtimeEvent, ChangeOperation } from '@platform/sdk';

import { useEffect, useRef } from 'react';

export type RealtimeHandlers<TRow> = {
  onInsert?: (event: RealtimeEvent<TRow>) => void;
  onUpdate?: (event: RealtimeEvent<TRow>) => void;
  onDelete?: (event: RealtimeEvent<TRow>) => void;
};

export type RealtimeStatus = 'pending' | 'connected' | 'disconnected' | 'error';

export function useRealtime<TRow>(
  channel: RealtimeChannel<TRow>,
  handlers: RealtimeHandlers<TRow>,
): RealtimeStatus {
  const statusRef = useRef<RealtimeStatus>('pending');
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const ops: ChangeOperation[] = ['insert', 'update', 'delete'];

    for (const op of ops) {
      channel.on(op, (event: RealtimeEvent<TRow>) => {
        const h = handlersRef.current;
        if (op === 'insert') h.onInsert?.(event);
        else if (op === 'update') h.onUpdate?.(event);
        else h.onDelete?.(event);
      });
    }

    const unsubStatus = channel.onStatusChange((s) => {
      statusRef.current = s;
    });

    void channel.subscribe();

    return () => {
      unsubStatus();
      void channel.unsubscribe();
    };
  }, [channel]);

  return statusRef.current;
}
