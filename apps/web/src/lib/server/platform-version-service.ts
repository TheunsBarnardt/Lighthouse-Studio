/**
 * In-memory platform version service for the Next.js dev composition root.
 * In production this is replaced by the real DB adapters via the CLI composition root.
 */

import { PLATFORM_VERSION } from '@platform/core';

interface PlatformVersion {
  releaseVersion: string;
  appliedAt: Date;
  appliedBy?: string;
  schemaMigrationHighWater?: string;
  notes?: string;
}

export interface DbVersionStatus {
  id: string;
  kind: 'postgres' | 'mssql' | 'mongo';
  current: PlatformVersion | null;
  needsUpgrade: boolean;
}

interface PlatformVersionStore {
  histories: Map<string, PlatformVersion[]>;
  upgradeInProgress: boolean;
}

const g = globalThis as typeof globalThis & { _platformVersionStore?: PlatformVersionStore };

function getStore(): PlatformVersionStore {
  if (!g._platformVersionStore) {
    g._platformVersionStore = {
      histories: new Map([['postgres-primary', []]]),
      upgradeInProgress: false,
    };
  }
  return g._platformVersionStore;
}

export function getDbVersionStatuses(): DbVersionStatus[] {
  const store = getStore();
  const dbs: Array<{ id: string; kind: 'postgres' | 'mssql' | 'mongo' }> = [
    { id: 'postgres-primary', kind: 'postgres' },
  ];
  return dbs.map(({ id, kind }) => {
    const history = store.histories.get(id) ?? [];
    const current = history[0] ?? null;
    return {
      id,
      kind,
      current,
      needsUpgrade: current === null || current.releaseVersion !== PLATFORM_VERSION,
    };
  });
}

export function getUpgradeHistory(): PlatformVersion[] {
  const store = getStore();
  const all: PlatformVersion[] = [];
  for (const history of store.histories.values()) {
    all.push(...history);
  }
  return all.sort((a, b) => b.appliedAt.getTime() - a.appliedAt.getTime());
}

export function isUpgradeInProgress(): boolean {
  return getStore().upgradeInProgress;
}

/** Records the initial platform version on first-run (setup flow). No-op if already recorded. */
export function recordInitialVersion(appliedBy: string): void {
  const store = getStore();
  for (const [id, history] of store.histories.entries()) {
    if (history.length === 0) {
      history.push({
        releaseVersion: PLATFORM_VERSION,
        appliedAt: new Date(),
        appliedBy,
      });
      store.histories.set(id, history);
    }
  }
}

export async function triggerUpgrade(appliedBy: string): Promise<void> {
  const store = getStore();
  if (store.upgradeInProgress) {
    throw new Error('Upgrade already in progress');
  }
  store.upgradeInProgress = true;

  await new Promise<void>((resolve) => {
    setTimeout(() => {
      for (const [id, history] of store.histories.entries()) {
        history.unshift({
          releaseVersion: PLATFORM_VERSION,
          appliedAt: new Date(),
          appliedBy,
        });
        store.histories.set(id, history);
      }
      store.upgradeInProgress = false;
      resolve();
    }, 2000);
  });
}
