import type { AuditEntryInput, MetadataValue } from '@platform/ports-audit';

export type UpgradeAuditEventType =
  | 'platform.upgrade.started'
  | 'platform.upgrade.preflight'
  | 'platform.upgrade.migrated'
  | 'platform.upgrade.recorded'
  | 'platform.upgrade.completed'
  | 'platform.upgrade.failed'
  | 'platform.upgrade.rolledback';

export function makeUpgradeAuditEntry(
  eventType: UpgradeAuditEventType,
  correlationId: string,
  outcome: 'success' | 'failure',
  // Callers build metadata from literals; cast is safe here.
  metadata: Record<string, unknown>,
  appliedBy?: string,
): AuditEntryInput {
  return {
    eventType,
    actor: {
      kind: appliedBy ? 'user' : 'system',
      id: appliedBy ?? null,
    },
    resource: { type: 'platform', id: 'installation' },
    action: eventType.split('.').pop() ?? eventType,
    outcome,
    correlationId,
    metadata: metadata as Record<string, MetadataValue>,
  };
}
