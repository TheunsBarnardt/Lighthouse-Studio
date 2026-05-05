'use client';

import { useEffect } from 'react';

export type SessionEventType = 'session.revoked' | 'session.created';

export interface SessionEvent {
  type: SessionEventType;
  sessionId: string;
  userId: string;
}

interface SessionEventListenerProps {
  userId: string;
  onRevoked: (sessionId: string) => void;
}

/**
 * Subscribes to session revocation events for the current user via SSE.
 * When any session is revoked (by admin or by "sign out everywhere"), the
 * parent updates its session list — or the auth context triggers sign-out
 * if the current session is revoked.
 */
export function SessionEventListener({ userId, onRevoked }: SessionEventListenerProps) {
  useEffect(() => {
    const url = `/api/v1/realtime/users/${userId}/session-events`;
    const source = new EventSource(url, { withCredentials: true });

    source.addEventListener('session', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data as string) as SessionEvent;
        if (data.type === 'session.revoked') {
          onRevoked(data.sessionId);
        }
      } catch {
        // Malformed event — ignore
      }
    });

    source.onerror = () => {
      // SSE auto-reconnects
    };

    return () => {
      source.close();
    };
  }, [userId, onRevoked]);

  return null;
}
