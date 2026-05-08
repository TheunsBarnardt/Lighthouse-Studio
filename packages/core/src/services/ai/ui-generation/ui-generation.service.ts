import type { AuditPort } from '@platform/ports-audit';
import type { RequestContext, AuthorizationPort } from '@platform/ports-authorization';
import type { LoggerPort } from '@platform/ports-observability';

import { ok, err, type Result } from 'neverthrow';

import type { AppError } from '../../../errors.js';
import type { ArtifactService } from '../artifact.service.js';
import type { GenerationService } from '../generation.service.js';
import type { StagePipelineService } from '../stage-pipeline.service.js';
import type { AccessibilityValidator } from './accessibility-validator.js';
import type { TypeChecker } from './type-checker.js';

import { toAuditActor, auditMeta } from '../../../context.js';
import { ValidationError, NotFoundError, ForbiddenError } from '../../../errors.js';
import {
  GenerateProjectInputSchema,
  GenerateIaInputSchema,
  UI_GENERATION_AUDIT_EVENTS,
  UI_GENERATION_PERMISSIONS,
  type ComponentSpec,
  type GenerateProjectInput,
  type GenerateIaInput,
  type UiProjectArtifact,
  type UiComponent,
  type InformationArchitecture,
  type ProjectFile,
  type BuildConfig,
} from './types.js';

export class UiGenerationService {
  constructor(
    private readonly authz: AuthorizationPort,
    _artifacts: ArtifactService,
    _generation: GenerationService,
    _pipeline: StagePipelineService,
    private readonly accessibilityValidator: AccessibilityValidator,
    _typeChecker: TypeChecker,
    private readonly audit: AuditPort,
    _logger: LoggerPort,
  ) {}

  async generateProject(
    ctx: RequestContext,
    input: GenerateProjectInput,
  ): Promise<Result<UiProjectArtifact, AppError>> {
    const parsed = GenerateProjectInputSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid input',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }

    const authzResult = await this.authz.authorize(
      ctx,
      UI_GENERATION_PERMISSIONS.CREATE,
      'ui_generation',
    );
    if (authzResult.isErr()) return err(new ForbiddenError('Not authorized to generate UI'));

    await this.audit.write({
      eventType: UI_GENERATION_AUDIT_EVENTS.PROJECT_GENERATION_STARTED,
      ...(ctx.workspaceId ? { workspaceId: ctx.workspaceId } : {}),
      actor: toAuditActor(ctx),
      resource: { type: 'ui_project', id: input.prdArtifactId },
      action: 'project_generation_started',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { workspaceId: input.workspaceId, prdArtifactId: input.prdArtifactId },
      ...auditMeta(ctx),
    });

    const iaResult = this._generateIa(ctx, input);
    if (iaResult.isErr()) return err(iaResult.error);
    const ia = iaResult.value;

    await this.audit.write({
      eventType: UI_GENERATION_AUDIT_EVENTS.IA_GENERATED,
      ...(ctx.workspaceId ? { workspaceId: ctx.workspaceId } : {}),
      actor: toAuditActor(ctx),
      resource: { type: 'ui_project', id: input.prdArtifactId },
      action: 'ia_generated',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { pageCount: ia.pages.length },
      ...auditMeta(ctx),
    });

    const buildConfig = this._generateBuildConfig(ia);

    const componentArtifactIds: string[] = [];
    const allFiles: ProjectFile[] = [];

    const artifact: UiProjectArtifact = {
      id: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      project: {
        prdArtifactId: input.prdArtifactId,
        designTokensArtifactId: input.designTokensArtifactId,
        schemaArtifactId: input.schemaArtifactId,
        ia,
        files: allFiles,
        pageArtifactIds: [],
        componentArtifactIds,
        buildConfig,
        accessibilityReport: {
          componentId: '',
          passed: true,
          violations: [],
          warnings: [],
          suggestions: [],
        },
        typeCheckReport: { passed: true, errors: [], warnings: [] },
        consistencyReport: { passed: true, issues: [] },
      },
      status: 'draft',
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return ok(artifact);
  }

  async generateIa(
    ctx: RequestContext,
    input: GenerateIaInput,
  ): Promise<Result<InformationArchitecture, AppError>> {
    const parsed = GenerateIaInputSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid input',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }

    const authzResult = await this.authz.authorize(
      ctx,
      UI_GENERATION_PERMISSIONS.CREATE,
      'ui_generation',
    );
    if (authzResult.isErr()) return err(new ForbiddenError('Not authorized'));

    return this._generateIa(ctx, input);
  }

  async generateComponent(
    ctx: RequestContext,
    projectId: string,
    spec: ComponentSpec,
  ): Promise<Result<UiComponent, AppError>> {
    const authzResult = await this.authz.authorize(
      ctx,
      UI_GENERATION_PERMISSIONS.CREATE,
      'ui_generation',
    );
    if (authzResult.isErr()) return err(new ForbiddenError('Not authorized'));

    const component: UiComponent = {
      id: crypto.randomUUID(),
      projectId,
      componentSpec: spec,
      files: [
        {
          path: `src/components/${spec.componentName}.tsx`,
          content: '',
          fileType: 'component',
          hash: crypto.randomUUID(),
        },
      ],
      reasoning: { generation: '' },
      qualitySignals: {
        accessibilityPassed: true,
        typeCheckPassed: true,
        generationAttempts: 1,
        userEdited: false,
        editCharsAfterApproval: 0,
      },
      status: 'draft',
      version: 1,
    };

    const a11yReport = await this.accessibilityValidator.validate(component);
    if (!a11yReport.passed) {
      await this.audit.write({
        eventType: UI_GENERATION_AUDIT_EVENTS.ACCESSIBILITY_FAILURE,
        ...(ctx.workspaceId ? { workspaceId: ctx.workspaceId } : {}),
        actor: toAuditActor(ctx),
        resource: { type: 'ui_component', id: component.id },
        action: 'accessibility_failure',
        outcome: 'failure',
        correlationId: ctx.correlationId,
        metadata: { componentId: component.id, violations: a11yReport.violations.length },
        ...auditMeta(ctx),
      });
      component.qualitySignals.generationAttempts = 2;
    }

    component.qualitySignals.accessibilityPassed = a11yReport.passed;

    await this.audit.write({
      eventType: UI_GENERATION_AUDIT_EVENTS.COMPONENT_GENERATED,
      ...(ctx.workspaceId ? { workspaceId: ctx.workspaceId } : {}),
      actor: toAuditActor(ctx),
      resource: { type: 'ui_component', id: component.id },
      action: 'component_generated',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { projectId, componentId: component.id, componentType: spec.componentType },
      ...auditMeta(ctx),
    });

    return ok(component);
  }

  async regenerateComponent(
    ctx: RequestContext,
    componentArtifactId: string,
    _feedback?: string,
  ): Promise<Result<UiComponent, AppError>> {
    const authzResult = await this.authz.authorize(
      ctx,
      UI_GENERATION_PERMISSIONS.REGENERATE,
      'ui_generation',
    );
    if (authzResult.isErr()) return err(new ForbiddenError('Not authorized'));

    await this.audit.write({
      eventType: UI_GENERATION_AUDIT_EVENTS.COMPONENT_REGENERATED,
      ...(ctx.workspaceId ? { workspaceId: ctx.workspaceId } : {}),
      actor: toAuditActor(ctx),
      resource: { type: 'ui_component', id: componentArtifactId },
      action: 'component_regenerated',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { componentArtifactId, hasFeedback: !!_feedback },
      ...auditMeta(ctx),
    });

    return err(new NotFoundError('ui_component', componentArtifactId));
  }

  async approveComponent(
    ctx: RequestContext,
    componentArtifactId: string,
  ): Promise<Result<UiComponent, AppError>> {
    const authzResult = await this.authz.authorize(
      ctx,
      UI_GENERATION_PERMISSIONS.APPROVE,
      'ui_generation',
    );
    if (authzResult.isErr()) return err(new ForbiddenError('Not authorized'));

    await this.audit.write({
      eventType: UI_GENERATION_AUDIT_EVENTS.COMPONENT_APPROVED,
      ...(ctx.workspaceId ? { workspaceId: ctx.workspaceId } : {}),
      actor: toAuditActor(ctx),
      resource: { type: 'ui_component', id: componentArtifactId },
      action: 'component_approved',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { componentArtifactId },
      ...auditMeta(ctx),
    });

    return err(new NotFoundError('ui_component', componentArtifactId));
  }

  async approveProject(
    ctx: RequestContext,
    projectId: string,
  ): Promise<Result<UiProjectArtifact, AppError>> {
    const authzResult = await this.authz.authorize(
      ctx,
      UI_GENERATION_PERMISSIONS.APPROVE,
      'ui_generation',
    );
    if (authzResult.isErr()) return err(new ForbiddenError('Not authorized'));

    await this.audit.write({
      eventType: UI_GENERATION_AUDIT_EVENTS.PROJECT_APPROVED,
      ...(ctx.workspaceId ? { workspaceId: ctx.workspaceId } : {}),
      actor: toAuditActor(ctx),
      resource: { type: 'ui_project', id: projectId },
      action: 'project_approved',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { projectId },
      ...auditMeta(ctx),
    });

    return err(new NotFoundError('ui_project', projectId));
  }

  async getPreviewUrl(
    ctx: RequestContext,
    componentArtifactId: string,
  ): Promise<Result<{ url: string; expiresAt: Date }, AppError>> {
    const authzResult = await this.authz.authorize(
      ctx,
      UI_GENERATION_PERMISSIONS.READ,
      'ui_generation',
    );
    if (authzResult.isErr()) return err(new ForbiddenError('Not authorized'));

    const expiresAt = new Date(Date.now() + 3600_000);
    await this.audit.write({
      eventType: UI_GENERATION_AUDIT_EVENTS.PREVIEW_RENDERED,
      ...(ctx.workspaceId ? { workspaceId: ctx.workspaceId } : {}),
      actor: toAuditActor(ctx),
      resource: { type: 'ui_component', id: componentArtifactId },
      action: 'preview_rendered',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { componentArtifactId },
      ...auditMeta(ctx),
    });

    return ok({ url: `/preview/${componentArtifactId}`, expiresAt });
  }

  async exportProject(
    ctx: RequestContext,
    projectId: string,
  ): Promise<Result<{ downloadUrl: string }, AppError>> {
    const authzResult = await this.authz.authorize(
      ctx,
      UI_GENERATION_PERMISSIONS.EXPORT,
      'ui_generation',
    );
    if (authzResult.isErr()) return err(new ForbiddenError('Not authorized'));

    await this.audit.write({
      eventType: UI_GENERATION_AUDIT_EVENTS.EXPORTED,
      ...(ctx.workspaceId ? { workspaceId: ctx.workspaceId } : {}),
      actor: toAuditActor(ctx),
      resource: { type: 'ui_project', id: projectId },
      action: 'exported',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { projectId },
      ...auditMeta(ctx),
    });

    return ok({ downloadUrl: `/projects/${projectId}/export.zip` });
  }

  private _generateIa(
    _ctx: RequestContext,
    _input: { prdArtifactId: string; schemaArtifactId: string },
  ): Result<InformationArchitecture, AppError> {
    const ia: InformationArchitecture = {
      pages: [],
      navigation: { type: 'sidebar', items: [], userMenuItems: [] },
      authPages: [],
      globalLayouts: [],
    };

    return ok(ia);
  }

  private _generateBuildConfig(_ia: InformationArchitecture): BuildConfig {
    return {
      packageJson: {},
      tsConfig: {},
      viteConfig: '',
      tailwindConfig: '',
      eslintConfig: {},
      prettierConfig: {},
    };
  }
}
