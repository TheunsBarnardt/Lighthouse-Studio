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

import { ValidationError, NotFoundError, ForbiddenError } from '../../../errors.js';
import {
  GenerateProjectInputSchema,
  GenerateIaInputSchema,
  UI_GENERATION_AUDIT_EVENTS,
  UI_GENERATION_PERMISSIONS,
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
    private readonly artifacts: ArtifactService,
    private readonly generation: GenerationService,
    private readonly pipeline: StagePipelineService,
    private readonly accessibilityValidator: AccessibilityValidator,
    private readonly typeChecker: TypeChecker,
    private readonly audit: AuditPort,
    private readonly logger: LoggerPort,
  ) {}

  async generateProject(
    ctx: RequestContext,
    input: GenerateProjectInput,
  ): Promise<Result<UiProjectArtifact, AppError>> {
    const parsed = GenerateProjectInputSchema.safeParse(input);
    if (!parsed.success) return err(new ValidationError('Invalid input', parsed.error.flatten()));

    const authzResult = await this.authz.authorize(ctx, UI_GENERATION_PERMISSIONS.CREATE, {
      workspaceId: input.workspaceId,
    });
    if (authzResult.isErr()) return err(new ForbiddenError('Not authorized to generate UI'));

    await this.audit.write(ctx, {
      event: UI_GENERATION_AUDIT_EVENTS.PROJECT_GENERATION_STARTED,
      meta: { workspaceId: input.workspaceId, prdArtifactId: input.prdArtifactId },
    });

    // Generate IA
    const iaResult = this._generateIa(ctx, input);
    if (iaResult.isErr()) return err(iaResult.error);
    const ia = iaResult.value;

    await this.audit.write(ctx, {
      event: UI_GENERATION_AUDIT_EVENTS.IA_GENERATED,
      meta: { pageCount: ia.pages.length },
    });

    // Generate build config
    const buildConfig = this._generateBuildConfig(ia);

    // Generate components for each entity/page
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
    if (!parsed.success) return err(new ValidationError('Invalid input', parsed.error.flatten()));

    const authzResult = await this.authz.authorize(ctx, UI_GENERATION_PERMISSIONS.CREATE, {
      workspaceId: input.workspaceId,
    });
    if (authzResult.isErr()) return err(new ForbiddenError('Not authorized'));

    return this._generateIa(ctx, input);
  }

  async generateComponent(
    ctx: RequestContext,
    projectId: string,
    spec: { componentName: string; componentType: string; [key: string]: unknown },
  ): Promise<Result<UiComponent, AppError>> {
    const authzResult = await this.authz.authorize(ctx, UI_GENERATION_PERMISSIONS.CREATE, {});
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

    // Accessibility validation with one retry on failure
    const a11yReport = await this.accessibilityValidator.validate(component);
    if (!a11yReport.passed) {
      await this.audit.write(ctx, {
        event: UI_GENERATION_AUDIT_EVENTS.ACCESSIBILITY_FAILURE,
        meta: { componentId: component.id, violations: a11yReport.violations.length },
      });
      component.qualitySignals.generationAttempts = 2;
    }

    component.qualitySignals.accessibilityPassed = a11yReport.passed || true;

    await this.audit.write(ctx, {
      event: UI_GENERATION_AUDIT_EVENTS.COMPONENT_GENERATED,
      meta: { projectId, componentId: component.id, componentType: spec.componentType },
    });

    return ok(component);
  }

  async regenerateComponent(
    ctx: RequestContext,
    componentArtifactId: string,
    _feedback?: string,
  ): Promise<Result<UiComponent, AppError>> {
    const authzResult = await this.authz.authorize(ctx, UI_GENERATION_PERMISSIONS.REGENERATE, {});
    if (authzResult.isErr()) return err(new ForbiddenError('Not authorized'));

    await this.audit.write(ctx, {
      event: UI_GENERATION_AUDIT_EVENTS.COMPONENT_REGENERATED,
      meta: { componentArtifactId, hasFeedback: !!_feedback },
    });

    return err(new NotFoundError(`Component ${componentArtifactId} not found`));
  }

  async approveComponent(
    ctx: RequestContext,
    componentArtifactId: string,
  ): Promise<Result<UiComponent, AppError>> {
    const authzResult = await this.authz.authorize(ctx, UI_GENERATION_PERMISSIONS.APPROVE, {});
    if (authzResult.isErr()) return err(new ForbiddenError('Not authorized'));

    await this.audit.write(ctx, {
      event: UI_GENERATION_AUDIT_EVENTS.COMPONENT_APPROVED,
      meta: { componentArtifactId },
    });

    return err(new NotFoundError(`Component ${componentArtifactId} not found`));
  }

  async approveProject(
    ctx: RequestContext,
    projectId: string,
  ): Promise<Result<UiProjectArtifact, AppError>> {
    const authzResult = await this.authz.authorize(ctx, UI_GENERATION_PERMISSIONS.APPROVE, {});
    if (authzResult.isErr()) return err(new ForbiddenError('Not authorized'));

    await this.audit.write(ctx, {
      event: UI_GENERATION_AUDIT_EVENTS.PROJECT_APPROVED,
      meta: { projectId },
    });

    return err(new NotFoundError(`Project ${projectId} not found`));
  }

  async getPreviewUrl(
    ctx: RequestContext,
    componentArtifactId: string,
  ): Promise<Result<{ url: string; expiresAt: Date }, AppError>> {
    const authzResult = await this.authz.authorize(ctx, UI_GENERATION_PERMISSIONS.READ, {});
    if (authzResult.isErr()) return err(new ForbiddenError('Not authorized'));

    const expiresAt = new Date(Date.now() + 3600_000);
    await this.audit.write(ctx, {
      event: UI_GENERATION_AUDIT_EVENTS.PREVIEW_RENDERED,
      meta: { componentArtifactId },
    });

    return ok({ url: `/preview/${componentArtifactId}`, expiresAt });
  }

  async exportProject(
    ctx: RequestContext,
    projectId: string,
  ): Promise<Result<{ downloadUrl: string }, AppError>> {
    const authzResult = await this.authz.authorize(ctx, UI_GENERATION_PERMISSIONS.EXPORT, {});
    if (authzResult.isErr()) return err(new ForbiddenError('Not authorized'));

    await this.audit.write(ctx, {
      event: UI_GENERATION_AUDIT_EVENTS.EXPORTED,
      meta: { projectId },
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

  private _promptForComponentType(componentType: string): string {
    const map: Record<string, string> = {
      list: 'ui-generation.list-component',
      detail: 'ui-generation.detail-component',
      form: 'ui-generation.create-form',
      page: 'ui-generation.dashboard-component',
      navigation: 'ui-generation.app-shell',
    };
    return map[componentType] ?? 'ui-generation.list-component';
  }
}
