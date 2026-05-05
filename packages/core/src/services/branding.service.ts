import type { AuditPort } from '@platform/ports-audit';
import type { AuthorizationPort, RequestContext } from '@platform/ports-authorization';
import type { LoggerPort } from '@platform/ports-observability';
import type { RepositoryPort } from '@platform/ports-persistence';

import { err, ok, type Result } from 'neverthrow';
import { z } from 'zod';

import type { AppError } from '../errors.js';

import { auditMeta, toAuditActor } from '../context.js';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
  WorkspaceContextRequiredError,
} from '../errors.js';
import { observable } from '../observability/observable.js';

/** CSS variable allowlist — only these tokens may be overridden via custom CSS. */
const ALLOWED_CSS_VARS = [
  '--color-primary',
  '--color-primary-foreground',
  '--color-accent',
  '--radius',
] as const;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

const WorkspaceBrandingSchema = z.object({
  logoFileId: z.string().uuid().optional(),
  primaryColor: z.string().regex(HEX_COLOR).optional(),
  companyName: z.string().max(255).optional(),
  customCss: z.string().max(4096).optional(),
  emailFromName: z.string().max(255).optional(),
});

export type WorkspaceBranding = z.infer<typeof WorkspaceBrandingSchema>;

export interface WorkspaceBrandingRecord extends WorkspaceBranding {
  id: string;
  version: number;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

type BrandingRepo = RepositoryPort<WorkspaceBrandingRecord>;

export class BrandingService {
  readonly getBranding!: (
    ctx: RequestContext,
    workspaceId: string,
  ) => Promise<Result<WorkspaceBranding, AppError>>;

  readonly setBranding!: (
    ctx: RequestContext,
    workspaceId: string,
    branding: WorkspaceBranding,
  ) => Promise<Result<void, AppError>>;

  readonly resetBranding!: (
    ctx: RequestContext,
    workspaceId: string,
  ) => Promise<Result<void, AppError>>;

  constructor(
    private readonly authz: AuthorizationPort,
    private readonly repo: BrandingRepo,
    private readonly audit: AuditPort,
    logger: LoggerPort,
  ) {
    const obs = { logger };
    const s = 'BrandingService';
    this.getBranding = observable(s, 'getBranding', obs, this._getBranding.bind(this));
    this.setBranding = observable(s, 'setBranding', obs, this._setBranding.bind(this));
    this.resetBranding = observable(s, 'resetBranding', obs, this._resetBranding.bind(this));
  }

  private async _getBranding(
    ctx: RequestContext,
    workspaceId: string,
  ): Promise<Result<WorkspaceBranding, AppError>> {
    const authResult = await this.authz.authorize(ctx, 'workspace.read_branding', 'workspace');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    const result = await this.repo.findOne({
      workspaceId: { _eq: workspaceId },
    } as Parameters<BrandingRepo['findOne']>[0]);

    if (result.isErr()) return err(new NotFoundError('workspace_branding', workspaceId));
    if (!result.value) return ok({}); // no branding set → return empty (use defaults)

    const { logoFileId, primaryColor, companyName, customCss, emailFromName } = result.value;
    return ok({
      ...(logoFileId !== undefined && { logoFileId }),
      ...(primaryColor !== undefined && { primaryColor }),
      ...(companyName !== undefined && { companyName }),
      ...(customCss !== undefined && { customCss }),
      ...(emailFromName !== undefined && { emailFromName }),
    });
  }

  private async _setBranding(
    ctx: RequestContext,
    workspaceId: string,
    branding: WorkspaceBranding,
  ): Promise<Result<void, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    // 1. Validate
    const parsed = WorkspaceBrandingSchema.safeParse(branding);
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid branding',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }

    // Sanitize custom CSS — only allow whitelisted variable declarations
    if (parsed.data.customCss) {
      const sanitized = this._sanitizeCss(parsed.data.customCss);
      parsed.data.customCss = sanitized;
    }

    // 2. Authorize
    const authResult = await this.authz.authorize(ctx, 'workspace.update_branding', 'workspace');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    // 3. Execute — upsert
    const existing = await this.repo.findOne({
      workspaceId: { _eq: workspaceId },
    } as Parameters<BrandingRepo['findOne']>[0]);

    const now = new Date();
    if (existing.isOk() && existing.value) {
      await this.repo.update(
        existing.value.id,
        {
          ...parsed.data,
          updatedBy: ctx.userId,
          updatedAt: now,
        } as Partial<WorkspaceBrandingRecord>,
        { expectedVersion: existing.value.version },
      );
    } else {
      await this.repo.create({
        id: crypto.randomUUID(),
        version: 1,
        workspaceId,
        ...parsed.data,
        createdAt: now,
        updatedAt: now,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      } as WorkspaceBrandingRecord);
    }

    // 4. Audit
    await this.audit.write({
      eventType: 'data_management.workspace.branding_updated',
      workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'workspace', id: workspaceId },
      action: 'branding_updated',
      outcome: 'success',
      correlationId: ctx.correlationId,
      ...auditMeta(ctx),
    });

    return ok(undefined);
  }

  private async _resetBranding(
    ctx: RequestContext,
    workspaceId: string,
  ): Promise<Result<void, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    const authResult = await this.authz.authorize(ctx, 'workspace.update_branding', 'workspace');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    const existing = await this.repo.findOne({
      workspaceId: { _eq: workspaceId },
    } as Parameters<BrandingRepo['findOne']>[0]);

    if (existing.isOk() && existing.value) {
      await this.repo.archive(existing.value.id);
    }

    await this.audit.write({
      eventType: 'data_management.workspace.branding_updated',
      workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'workspace', id: workspaceId },
      action: 'branding_reset',
      outcome: 'success',
      correlationId: ctx.correlationId,
      ...auditMeta(ctx),
    });

    return ok(undefined);
  }

  private _sanitizeCss(css: string): string {
    const allowed = new Set<string>(ALLOWED_CSS_VARS);
    // Keep only lines that declare an allowed CSS variable
    return css
      .split('\n')
      .filter((line) => {
        const trimmed = line.trim();
        if (!trimmed.startsWith('--')) return false;
        const varName = trimmed.split(':')[0]?.trim();
        return varName !== undefined && allowed.has(varName);
      })
      .join('\n');
  }
}
