'use client';

import { useEffect } from 'react';

export interface StorageEvent {
  type: 'file.created' | 'file.updated' | 'file.deleted' | 'file.moved' | 'bucket.changed';
  workspaceId: string;
  bucketId?: string;
  fileId?: string;
  payload: unknown;
}

interface StorageEventListenerProps {
  workspaceId: string;
  onEvent: (event: StorageEvent) => void;
}

/**
 * Subscribes to the workspace's storage event stream via SSE and calls
 * onEvent for each storage mutation event. The parent component uses
 * these events to update the file list without a full refresh.
 */
export function StorageEventListener({ workspaceId, onEvent }: StorageEventListenerProps) {
  useEffect(() => {
    const url = `/api/v1/realtime/workspace/${workspaceId}/storage/events`;
    const source = new EventSource(url, { withCredentials: true });

    source.addEventListener('storage', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data as string) as StorageEvent;
        onEvent(data);
      } catch {
        // Malformed event — ignore
      }
    });

    source.onerror = () => {
      // SSE will auto-reconnect; no explicit handling needed
    };

    return () => {
      source.close();
    };
  }, [workspaceId, onEvent]);

  // Renders nothing — side-effect only
  return null;
}
