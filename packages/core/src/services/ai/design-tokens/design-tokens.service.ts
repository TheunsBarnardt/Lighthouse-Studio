import { err, ok, type Result } from 'neverthrow';

import type { AuditPort } from '@platform/ports-audit';
import type { AuthorizationPort, RequestContext } from '@platform/ports-authorization';
import type { LoggerPort } from '@platform/ports-observability';

import { ForbiddenError, NotFoundError, ValidationError } from '../../errors.js';
import { auditMeta, toAuditActor } from '../../context.js';
import { observable } from '../../observability/observable.js';
import type { ArtifactService } from '../artifact.service.js';
import type { GenerationService } from '../generation.service.js';
import type { StagePipelineService } from '../stage-pipeline.service.js';

// ── Register all design-token prompts ────────────────────────────────────────
import '../../../ai/prompts/design-tokens/index.js';

import { DESIGN_TOKENS_AUDIT_EVENTS } from './audit-events.js';
import { DESIGN_TOKENS_PERMISSIONS } from './permissions.js';
import { validateTokenSetAccessibility } from './accessibility-validator.js';
import { generateColorScale } from './oklch.js';
import {
  DesignTokenSetSchema,
  TOKEN_CATEGORIES,
  type AccessibilityReport,
  type BrandInputs,
  type DesignTokenSet,
  type ExportFormat,
  type GenerateTokensInput,
  type TokenCategory,
} from './types.js';
import { CssExporter } from './exporters/css-exporter.js';
import { TailwindExporter } from './exporters/tailwind-exporter.js';
import { JsonDtcgExporter } from './exporters/json-dtcg-exporter.js';
import { TypeScriptExporter } from './exporters/typescript-exporter.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DesignTokenArtifact {
  id: string;
  workspaceId: string;
  prdArtifactId: string;
  tokenSet: DesignTokenSet;
  version: number;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class DesignTokensService {
  readonly generateTokens: (
    ctx: RequestContext,
    input: GenerateTokensInput,
  ) => Promise<Result<DesignTokenArtifact, Error>>;

  readonly getTokens: (
    ctx: RequestContext,
    artifactId: string,
  ) => Promise<Result<DesignTokenArtifact, Error>>;

  readonly editToken: (
    ctx: RequestContext,
    artifactId: string,
    tokenPath: string,
    newValue: unknown,
  ) => Promise<Result<DesignTokenArtifact, Error>>;

  readonly regenerateCategory: (
    ctx: RequestContext,
    artifactId: string,
    category: TokenCategory,
    feedback?: string,
  ) => Promise<Result<DesignTokenArtifact, Error>>;

  readonly regenerateAll: (
    ctx: RequestContext,
    artifactId: string,
    feedback?: string,
  ) => Promise<Result<DesignTokenArtifact, Error>>;

  readonly validateAccessibility: (
    ctx: RequestContext,
    artifactId: string,
  ) => Promise<Result<AccessibilityReport, Error>>;

  readonly export: (
    ctx: RequestContext,
    artifactId: string,
    format: ExportFormat,
  ) => Promise<Result<{ content: string; filename: string }, Error>>;

  readonly submitForApproval: (
    ctx: RequestContext,
    artifactId: string,
  ) => Promise<Result<DesignTokenArtifact, Error>>;

  constructor(
    private readonly authz: AuthorizationPort,
    private readonly artifacts: ArtifactService,
    private readonly generation: GenerationService,
    private readonly pipeline: StagePipelineService,
    private readonly audit: AuditPort,
    private readonly logger: LoggerPort,
  ) {
    const wrap = <TArgs extends unknown[], TReturn>(
      name: string,
      fn: (...args: TArgs) => Promise<TReturn>,
    ) =>
      observable('DesignTokensService', name, { logger: this.logger }, fn) as (
        ...args: TArgs
      ) => Promise<TReturn>;

    this.generateTokens = wrap('generateTokens', this._generateTokens.bind(this));
    this.getTokens = wrap('getTokens', this._getTokens.bind(this));
    this.editToken = wrap('editToken', this._editToken.bind(this));
    this.regenerateCategory = wrap('regenerateCategory', this._regenerateCategory.bind(this));
    this.regenerateAll = wrap('regenerateAll', this._regenerateAll.bind(this));
    this.validateAccessibility = wrap('validateAccessibility', this._validateAccessibility.bind(this));
    this.export = wrap('export', this._export.bind(this));
    this.submitForApproval = wrap('submitForApproval', this._submitForApproval.bind(this));
  }

  // ── generateTokens ──────────────────────────────────────────────────────────

  private async _generateTokens(
    ctx: RequestContext,
    input: GenerateTokensInput,
  ): Promise<Result<DesignTokenArtifact, Error>> {
    // 1. Validate
    const parsed = DesignTokenSetSchema.partial().safeParse({
      prdArtifactId: input.prdArtifactId,
      brandInputs: input.brandInputs,
    });
    if (!parsed.success) {
      return err(new ValidationError('Invalid generate tokens input', { issues: parsed.error.issues }));
    }

    // 2. Authorize
    const authzResult = await this.authz.authorize(ctx, DESIGN_TOKENS_PERMISSIONS.CREATE, {
      type: 'workspace', id: ctx.workspaceId,
    });
    if (authzResult.isErr()) return err(new ForbiddenError('Not allowed to generate design tokens'));

    // 3. Execute — run per-category generation
    const colorResult = await this.generation.run('design-tokens.color-palette', {
      projectType: 'application',
      targetUsers: 'end users',
      vibeDescriptors: input.brandInputs.vibeDescriptors,
      brandColors: input.brandInputs.brandColors ?? [],
      referenceUrls: input.brandInputs.referenceUrls ?? [],
    });
    if (colorResult.isErr()) return err(colorResult.error);

    const typographyResult = await this.generation.run('design-tokens.typography', {
      projectType: 'application',
      vibeDescriptors: input.brandInputs.vibeDescriptors,
    });
    if (typographyResult.isErr()) return err(typographyResult.error);

    const spacingResult = await this.generation.run('design-tokens.spacing', {
      projectType: 'application',
      vibeDescriptors: input.brandInputs.vibeDescriptors,
      baseUnit: 4,
    });
    if (spacingResult.isErr()) return err(spacingResult.error);

    const sizingResult = await this.generation.run('design-tokens.sizing', {
      projectType: 'application',
      vibeDescriptors: input.brandInputs.vibeDescriptors,
    });
    if (sizingResult.isErr()) return err(sizingResult.error);

    const borderRadiusResult = await this.generation.run('design-tokens.border-radius', {
      projectType: 'application',
      vibeDescriptors: input.brandInputs.vibeDescriptors,
    });
    if (borderRadiusResult.isErr()) return err(borderRadiusResult.error);

    const shadowsResult = await this.generation.run('design-tokens.shadows', {
      projectType: 'application',
      vibeDescriptors: input.brandInputs.vibeDescriptors,
    });
    if (shadowsResult.isErr()) return err(shadowsResult.error);

    const motionResult = await this.generation.run('design-tokens.motion', {
      vibeDescriptors: input.brandInputs.vibeDescriptors,
    });
    if (motionResult.isErr()) return err(motionResult.error);

    const colors = colorResult.value as Record<string, unknown>;
    const typography = typographyResult.value as Record<string, unknown>;
    const spacing = spacingResult.value as Record<string, unknown>;
    const sizing = sizingResult.value as Record<string, unknown>;
    const borderRadius = borderRadiusResult.value as Record<string, unknown>;
    const shadows = shadowsResult.value as Record<string, unknown>;
    const motion = motionResult.value as Record<string, unknown>;

    // Strip reasoning from outputs
    const { reasoning: _cr, ...colorsClean } = colors as { reasoning: string } & Record<string, unknown>;
    const { reasoning: _tr, ...typographyClean } = typography as { reasoning: string } & Record<string, unknown>;
    const { reasoning: _sr, ...spacingClean } = spacing as { reasoning: string } & Record<string, unknown>;
    const { reasoning: _sir, ...sizingClean } = sizing as { reasoning: string } & Record<string, unknown>;
    const { reasoning: _brr, ...borderRadiusClean } = borderRadius as { reasoning: string } & Record<string, unknown>;
    const { reasoning: _shr, ...shadowsClean } = shadows as { reasoning: string } & Record<string, unknown>;
    const { reasoning: _mr, ...motionClean } = motion as { reasoning: string } & Record<string, unknown>;

    const tokenSet: DesignTokenSet = {
      prdArtifactId: input.prdArtifactId,
      brandInputs: input.brandInputs,
      colors: colorsClean as DesignTokenSet['colors'],
      typography: typographyClean as DesignTokenSet['typography'],
      spacing: spacingClean as DesignTokenSet['spacing'],
      sizing: sizingClean as DesignTokenSet['sizing'],
      borderRadius: borderRadiusClean as DesignTokenSet['borderRadius'],
      shadows: shadowsClean as DesignTokenSet['shadows'],
      motion: motionClean as DesignTokenSet['motion'],
      zIndex: { base: 0, dropdown: 1000, sticky: 1100, modal: 1200, popover: 1300, toast: 1400, tooltip: 1500 },
      breakpoints: { sm: '640px', md: '768px', lg: '1024px', xl: '1280px', '2xl': '1536px' },
    };

    // 4. Accessibility validation
    const accessibilityReport = validateTokenSetAccessibility(tokenSet);

    const artifact: DesignTokenArtifact = {
      id: `dt_${Date.now()}`,
      workspaceId: ctx.workspaceId,
      prdArtifactId: input.prdArtifactId,
      tokenSet,
      version: 1,
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // 5. Audit
    await this.audit.write({
      event: DESIGN_TOKENS_AUDIT_EVENTS.SET_GENERATED,
      actor: toAuditActor(ctx),
      resource: { type: 'design_token_set', id: artifact.id },
      meta: auditMeta(ctx, { prdArtifactId: input.prdArtifactId, accessibilityPassRate: accessibilityReport.passCount / (accessibilityReport.passCount + accessibilityReport.failCount) }),
    });

    return ok(artifact);
  }

  // ── getTokens ───────────────────────────────────────────────────────────────

  private async _getTokens(
    ctx: RequestContext,
    artifactId: string,
  ): Promise<Result<DesignTokenArtifact, Error>> {
    const authzResult = await this.authz.authorize(ctx, DESIGN_TOKENS_PERMISSIONS.READ, {
      type: 'workspace', id: ctx.workspaceId,
    });
    if (authzResult.isErr()) return err(new ForbiddenError('Not allowed to read design tokens'));

    const artifactResult = await this.artifacts.getById(ctx, artifactId);
    if (artifactResult.isErr()) return err(artifactResult.error);
    if (!artifactResult.value) return err(new NotFoundError(`Design token artifact ${artifactId} not found`));

    return ok(artifactResult.value as DesignTokenArtifact);
  }

  // ── editToken ───────────────────────────────────────────────────────────────

  private async _editToken(
    ctx: RequestContext,
    artifactId: string,
    tokenPath: string,
    newValue: unknown,
  ): Promise<Result<DesignTokenArtifact, Error>> {
    if (!tokenPath || tokenPath.trim().length === 0) {
      return err(new ValidationError('tokenPath is required'));
    }

    const authzResult = await this.authz.authorize(ctx, DESIGN_TOKENS_PERMISSIONS.EDIT, {
      type: 'workspace', id: ctx.workspaceId,
    });
    if (authzResult.isErr()) return err(new ForbiddenError('Not allowed to edit design tokens'));

    const artifactResult = await this.artifacts.getById(ctx, artifactId);
    if (artifactResult.isErr()) return err(artifactResult.error);
    if (!artifactResult.value) return err(new NotFoundError(`Design token artifact ${artifactId} not found`));

    const artifact = artifactResult.value as DesignTokenArtifact;

    // Apply the edit at tokenPath (e.g., 'colors.primary.500')
    const updatedSet = applyTokenEdit(artifact.tokenSet, tokenPath, newValue);
    const updated: DesignTokenArtifact = { ...artifact, tokenSet: updatedSet, updatedAt: new Date() };

    await this.audit.write({
      event: DESIGN_TOKENS_AUDIT_EVENTS.TOKEN_EDITED,
      actor: toAuditActor(ctx),
      resource: { type: 'design_token_set', id: artifactId },
      meta: auditMeta(ctx, { tokenPath, newValue }),
    });

    return ok(updated);
  }

  // ── regenerateCategory ──────────────────────────────────────────────────────

  private async _regenerateCategory(
    ctx: RequestContext,
    artifactId: string,
    category: TokenCategory,
    feedback?: string,
  ): Promise<Result<DesignTokenArtifact, Error>> {
    const authzResult = await this.authz.authorize(ctx, DESIGN_TOKENS_PERMISSIONS.EDIT, {
      type: 'workspace', id: ctx.workspaceId,
    });
    if (authzResult.isErr()) return err(new ForbiddenError('Not allowed to edit design tokens'));

    const artifactResult = await this.artifacts.getById(ctx, artifactId);
    if (artifactResult.isErr()) return err(artifactResult.error);
    if (!artifactResult.value) return err(new NotFoundError(`Design token artifact ${artifactId} not found`));

    const artifact = artifactResult.value as DesignTokenArtifact;

    const regenResult = await this.generation.run('design-tokens.regeneration', {
      category,
      currentTokens: artifact.tokenSet[category] as Record<string, unknown>,
      feedback: feedback ?? 'Apply the original vibe with fresh variation',
      brandInputs: artifact.tokenSet.brandInputs,
    });
    if (regenResult.isErr()) return err(regenResult.error);

    const { updatedTokens } = regenResult.value as { updatedTokens: Record<string, unknown>; reasoning: string };
    const updatedSet = { ...artifact.tokenSet, [category]: updatedTokens };
    const updated: DesignTokenArtifact = { ...artifact, tokenSet: updatedSet, updatedAt: new Date() };

    await this.audit.write({
      event: DESIGN_TOKENS_AUDIT_EVENTS.CATEGORY_REGENERATED,
      actor: toAuditActor(ctx),
      resource: { type: 'design_token_set', id: artifactId },
      meta: auditMeta(ctx, { category, feedback }),
    });

    return ok(updated);
  }

  // ── regenerateAll ───────────────────────────────────────────────────────────

  private async _regenerateAll(
    ctx: RequestContext,
    artifactId: string,
    feedback?: string,
  ): Promise<Result<DesignTokenArtifact, Error>> {
    const authzResult = await this.authz.authorize(ctx, DESIGN_TOKENS_PERMISSIONS.EDIT, {
      type: 'workspace', id: ctx.workspaceId,
    });
    if (authzResult.isErr()) return err(new ForbiddenError('Not allowed to edit design tokens'));

    const artifactResult = await this.artifacts.getById(ctx, artifactId);
    if (artifactResult.isErr()) return err(artifactResult.error);
    if (!artifactResult.value) return err(new NotFoundError(`Design token artifact ${artifactId} not found`));

    const artifact = artifactResult.value as DesignTokenArtifact;

    const generateResult = await this._generateTokens(ctx, {
      prdArtifactId: artifact.prdArtifactId,
      brandInputs: {
        ...artifact.tokenSet.brandInputs,
        vibeDescriptors: feedback
          ? [...artifact.tokenSet.brandInputs.vibeDescriptors, feedback]
          : artifact.tokenSet.brandInputs.vibeDescriptors,
      },
    });
    if (generateResult.isErr()) return err(generateResult.error);

    await this.audit.write({
      event: DESIGN_TOKENS_AUDIT_EVENTS.FULL_SET_REGENERATED,
      actor: toAuditActor(ctx),
      resource: { type: 'design_token_set', id: artifactId },
      meta: auditMeta(ctx, { feedback }),
    });

    return ok({ ...generateResult.value, id: artifactId });
  }

  // ── validateAccessibility ───────────────────────────────────────────────────

  private async _validateAccessibility(
    ctx: RequestContext,
    artifactId: string,
  ): Promise<Result<AccessibilityReport, Error>> {
    const authzResult = await this.authz.authorize(ctx, DESIGN_TOKENS_PERMISSIONS.READ, {
      type: 'workspace', id: ctx.workspaceId,
    });
    if (authzResult.isErr()) return err(new ForbiddenError('Not allowed to read design tokens'));

    const artifactResult = await this.artifacts.getById(ctx, artifactId);
    if (artifactResult.isErr()) return err(artifactResult.error);
    if (!artifactResult.value) return err(new NotFoundError(`Design token artifact ${artifactId} not found`));

    const artifact = artifactResult.value as DesignTokenArtifact;
    const report = validateTokenSetAccessibility(artifact.tokenSet);

    await this.audit.write({
      event: DESIGN_TOKENS_AUDIT_EVENTS.ACCESSIBILITY_CHECK_RUN,
      actor: toAuditActor(ctx),
      resource: { type: 'design_token_set', id: artifactId },
      meta: auditMeta(ctx, { passCount: report.passCount, failCount: report.failCount }),
    });

    return ok(report);
  }

  // ── export ──────────────────────────────────────────────────────────────────

  private async _export(
    ctx: RequestContext,
    artifactId: string,
    format: ExportFormat,
  ): Promise<Result<{ content: string; filename: string }, Error>> {
    const authzResult = await this.authz.authorize(ctx, DESIGN_TOKENS_PERMISSIONS.EXPORT, {
      type: 'workspace', id: ctx.workspaceId,
    });
    if (authzResult.isErr()) return err(new ForbiddenError('Not allowed to export design tokens'));

    const artifactResult = await this.artifacts.getById(ctx, artifactId);
    if (artifactResult.isErr()) return err(artifactResult.error);
    if (!artifactResult.value) return err(new NotFoundError(`Design token artifact ${artifactId} not found`));

    const artifact = artifactResult.value as DesignTokenArtifact;

    let result: { content: string; filename: string };
    switch (format) {
      case 'css':
        result = new CssExporter().export(artifact.tokenSet);
        break;
      case 'tailwind':
        result = new TailwindExporter().export(artifact.tokenSet);
        break;
      case 'json_dtcg':
        result = new JsonDtcgExporter().export(artifact.tokenSet);
        break;
      case 'typescript':
        result = new TypeScriptExporter().export(artifact.tokenSet);
        break;
    }

    await this.audit.write({
      event: DESIGN_TOKENS_AUDIT_EVENTS.EXPORTED,
      actor: toAuditActor(ctx),
      resource: { type: 'design_token_set', id: artifactId },
      meta: auditMeta(ctx, { format }),
    });

    return ok(result);
  }

  // ── submitForApproval ───────────────────────────────────────────────────────

  private async _submitForApproval(
    ctx: RequestContext,
    artifactId: string,
  ): Promise<Result<DesignTokenArtifact, Error>> {
    const authzResult = await this.authz.authorize(ctx, DESIGN_TOKENS_PERMISSIONS.EDIT, {
      type: 'workspace', id: ctx.workspaceId,
    });
    if (authzResult.isErr()) return err(new ForbiddenError('Not allowed to submit design tokens'));

    const artifactResult = await this.artifacts.getById(ctx, artifactId);
    if (artifactResult.isErr()) return err(artifactResult.error);
    if (!artifactResult.value) return err(new NotFoundError(`Design token artifact ${artifactId} not found`));

    const artifact = artifactResult.value as DesignTokenArtifact;
    const updated: DesignTokenArtifact = { ...artifact, status: 'pending_approval', updatedAt: new Date() };

    await this.pipeline.submitForApproval(ctx, { type: 'design_token_set', id: artifactId });

    await this.audit.write({
      event: DESIGN_TOKENS_AUDIT_EVENTS.SUBMITTED,
      actor: toAuditActor(ctx),
      resource: { type: 'design_token_set', id: artifactId },
      meta: auditMeta(ctx, {}),
    });

    return ok(updated);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function applyTokenEdit(tokenSet: DesignTokenSet, tokenPath: string, newValue: unknown): DesignTokenSet {
  const parts = tokenPath.split('.');
  const result = JSON.parse(JSON.stringify(tokenSet)) as Record<string, unknown>;
  let cursor = result;
  for (let i = 0; i < parts.length - 1; i++) {
    cursor = cursor[parts[i]] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]] = newValue;
  return result as unknown as DesignTokenSet;
}
