/**
 * In-process pub/sub bus for workspace member events.
 * SSE route handlers subscribe; mutation routes publish.
 * Singleton survives Next.js HMR via globalThis.
 */

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

type Subscriber = (event: MemberEvent) => void;

interface EventBus {
  subscribe(workspaceId: string, fn: Subscriber): () => void;
  publish(event: MemberEvent): void;
}

function createBus(): EventBus {
  const subs = new Map<string, Set<Subscriber>>();

  return {
    subscribe(workspaceId, fn) {
      let set = subs.get(workspaceId);
      if (!set) {
        set = new Set();
        subs.set(workspaceId, set);
      }
      set.add(fn);
      return () => {
        set.delete(fn);
        if (set.size === 0) subs.delete(workspaceId);
      };
    },

    publish(event) {
      const set = subs.get(event.workspaceId);
      if (!set) return;
      for (const fn of set) {
        try {
          fn(event);
        } catch {
          /* subscriber errors must not break other subscribers */
        }
      }
    },
  };
}

const g = globalThis as typeof globalThis & { _memberEventBus?: EventBus };
if (!g._memberEventBus) g._memberEventBus = createBus();

export const memberEventBus: EventBus = g._memberEventBus;
