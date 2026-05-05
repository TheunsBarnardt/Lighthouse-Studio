import type { ColdArchivePort } from '@platform/ports-audit';
import type { ColdArchiveChunk, ColdArchiveVerification } from '@platform/ports-audit';

import { AuditError } from '@platform/ports-audit';
import { err, type Result } from 'neverthrow';

export interface B2ColdArchiveConfig {
  /** Backblaze B2 application key ID */
  keyId: string;
  /** Backblaze B2 application key */
  applicationKey: string;
  /** Target bucket name (must have object lock enabled) */
  bucketName: string;
  /** B2 bucket ID */
  bucketId: string;
  /** Object lock retention days (minimum 1, recommended ≥ 2555 for 7-year retention) */
  lockRetentionDays: number;
  /**
   * PEM-encoded Ed25519 or RSA private key for signing chunk manifests.
   * Must match the public key published in the platform's installation manifest.
   */
  signingKeyPem: string;
  /** Key ID tag embedded in the signature for rotation tracking */
  signingKeyId: string;
}

/**
 * Backblaze B2 cold-archive adapter — gated by PLATFORM_COLD_ARCHIVE_ENABLED.
 *
 * STATUS: STUB — not yet implemented.
 *
 * This package establishes the correct hexagonal boundary (ColdArchivePort → B2 SDK)
 * and is wired into the composition root when cold archival is enabled. The full
 * implementation requires:
 *   1. `@backblaze/b2` or AWS S3-compatible SDK (B2 supports S3 API)
 *   2. `node:crypto` createSign / createVerify for Ed25519 signatures
 *   3. The AuditPort to query events by workspace/date for archival
 *
 * See ADR-0074 for the design rationale and chunk format.
 *
 * @throws {AuditError} with code 'NOT_IMPLEMENTED' on any method call until implemented.
 */
export class B2ColdArchiveAdapter implements ColdArchivePort {
  constructor(private readonly config: B2ColdArchiveConfig) {}

  archiveDay(
    _workspaceId: string | null,
    _date: string,
  ): Promise<Result<ColdArchiveChunk, AuditError>> {
    return Promise.resolve(
      err(
        new AuditError(
          'NOT_IMPLEMENTED',
          'B2ColdArchiveAdapter.archiveDay is not yet implemented. See ADR-0074.',
        ),
      ),
    );
  }

  verifyChunk(_objectKey: string): Promise<Result<ColdArchiveVerification, AuditError>> {
    return Promise.resolve(
      err(
        new AuditError(
          'NOT_IMPLEMENTED',
          'B2ColdArchiveAdapter.verifyChunk is not yet implemented. See ADR-0074.',
        ),
      ),
    );
  }

  listChunks(
    _workspaceId: string | null,
    _limit?: number,
  ): Promise<Result<ColdArchiveChunk[], AuditError>> {
    return Promise.resolve(
      err(
        new AuditError(
          'NOT_IMPLEMENTED',
          'B2ColdArchiveAdapter.listChunks is not yet implemented. See ADR-0074.',
        ),
      ),
    );
  }
}
