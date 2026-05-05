/**
 * Server-side StorageService singleton for Next.js route handlers.
 * Uses in-memory adapters for development; replace via production composition root.
 */
import { StorageService } from '@platform/core';
import {
  createInMemoryAudit,
  createInMemoryAuthz,
  createInMemoryLogger,
  createInMemoryObjectStorage,
  createInMemoryRepo,
} from '@platform/core/testing';

let _service: StorageService | null = null;

export function getStorageService(): StorageService {
  if (!_service) {
    _service = new StorageService(
      createInMemoryAuthz(),
      createInMemoryObjectStorage(),
      createInMemoryRepo(),
      createInMemoryRepo(),
      createInMemoryRepo(),
      createInMemoryRepo(),
      createInMemoryRepo(),
      createInMemoryAudit(),
      createInMemoryLogger(),
    );
  }
  return _service;
}
