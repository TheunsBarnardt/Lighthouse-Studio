'use client';

import { useEffect } from 'react';

export type MemberEventType =
  | 'member.added'
  | 'member.removed'
  | 'member.role_changed'
  | 'invitation.accepted'
  | 'invitation.revoked';

export interface MemberEvent {
  type: MemberEventType;
  workspaceId: string;
  userId?: string;
  invitationToken?: string;
  payload: unknown;
}

interface MemberEventListenerProps {
  workspaceId: string;
  onEvent: (event: MemberEvent) => void;
}

/**
 * Subscribes to workspace member events via SSE (Objective 14 realtime infrastructure).
 * Calls onEvent for each mutation; parent components use it to refresh lists without polling.
 */
export function MemberEventListener({ workspaceId, onEvent }: MemberEventListenerProps) {
  useEffect(() => {
    const url = `/api/v1/realtime/workspace/${workspaceId}/members/events`;
    const source = new EventSource(url, { withCredentials: true });

    source.addEventListener('member', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data as string) as MemberEvent;
        onEvent(data);
      } catch {
        // Malformed event — ignore
      }
    });

    source.onerror = () => {
      // SSE auto-reconnects; no handling needed
    };

    return () => {
      source.close();
    };
  }, [workspaceId, onEvent]);

  return null;
}
