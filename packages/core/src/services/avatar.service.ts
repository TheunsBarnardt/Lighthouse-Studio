import type { AuditPort } from '@platform/ports-audit';
import type { AuthorizationPort, RequestContext } from '@platform/ports-authorization';
import type { LoggerPort } from '@platform/ports-observability';
import type { ObjectStoragePort } from '@platform/ports-storage';

import { err, ok, type Result } from 'neverthrow';
import { z } from 'zod';

import type { AppError } from '../errors.js';

import { auditMeta, toAuditActor } from '../context.js';
import {
  ForbiddenError,
  InternalError,
  ValidationError,
  WorkspaceContextRequiredError,
} from '../errors.js';
import { observable } from '../observability/observable.js';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const UploadAvatarSchema = z.object({
  mimeType: z.enum(ALLOWED_MIME as unknown as [string, ...string[]]),
  sizeBytes: z.number().int().positive().max(MAX_BYTES),
});

export type UploadAvatarInput = z.infer<typeof UploadAvatarSchema>;

export class AvatarService {
  readonly uploadAvatar!: (
    ctx: RequestContext,
    input: UploadAvatarInput,
    data: Buffer,
  ) => Promise<Result<{ url: string }, AppError>>;

  readonly deleteAvatar!: (ctx: RequestContext) => Promise<Result<void, AppError>>;

  readonly getAvatarKey!: (userId: string) => string;

  constructor(
    private readonly authz: AuthorizationPort,
    private readonly storage: ObjectStoragePort,
    private readonly audit: AuditPort,
    logger: LoggerPort,
  ) {
    const obs = { logger };
    const s = 'AvatarService';
    this.uploadAvatar = observable(s, 'uploadAvatar', obs, this._uploadAvatar.bind(this));
    this.deleteAvatar = observable(s, 'deleteAvatar', obs, this._deleteAvatar.bind(this));
    this.getAvatarKey = (userId: string) => `avatars/${userId}/avatar.jpg`;
  }

  private async _uploadAvatar(
    ctx: RequestContext,
    input: UploadAvatarInput,
    data: Buffer,
  ): Promise<Result<{ url: string }, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    // 1. Validate
    const parsed = UploadAvatarSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid avatar upload',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }

    // 2. Authorize — user must be acting on their own avatar (or admin)
    const authResult = await this.authz.authorize(ctx, 'user.update_profile', 'user');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    // 3. Execute — store in object storage
    const key = this.getAvatarKey(ctx.userId);
    const putResult = await this.storage.put(key, data, {
      contentType: parsed.data.mimeType,
    });
    if (putResult.isErr()) {
      return err(new InternalError('Avatar storage failed', { cause: putResult.error }));
    }

    // 4. Audit
    await this.audit.write({
      eventType: 'data_management.user.avatar_uploaded',
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'user', id: ctx.userId },
      action: 'avatar_uploaded',
      outcome: 'success',
      correlationId: ctx.correlationId,
      ...auditMeta(ctx),
    });

    // Return the path (caller constructs full URL)
    return ok({ url: `/api/v1/me/avatar` });
  }

  private async _deleteAvatar(ctx: RequestContext): Promise<Result<void, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    // 1. Authorize
    const authResult = await this.authz.authorize(ctx, 'user.update_profile', 'user');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    // 2. Execute
    const key = this.getAvatarKey(ctx.userId);
    const deleteResult = await this.storage.delete(key);
    if (deleteResult.isErr()) {
      return err(new InternalError('Avatar deletion failed', { cause: deleteResult.error }));
    }

    // 3. Audit
    await this.audit.write({
      eventType: 'data_management.user.avatar_deleted',
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'user', id: ctx.userId },
      action: 'avatar_deleted',
      outcome: 'success',
      correlationId: ctx.correlationId,
      ...auditMeta(ctx),
    });

    return ok(undefined);
  }
}
