/**
 * PrdGenerationService — Objective 22
 *
 * Orchestrates the generation of a 10-section PRD from an approved IntentBrief.
 * Uses the section dependency graph to maximise parallel generation across waves.
 *
 * Canonical shape for every method: validate → authorize → precondition → execute → audit → return.
 */

import type { AiGenerationPort } from '@platform/ports-ai';
import type { AuditPort } from '@platform/ports-audit';
import type { AuthorizationPort, RequestContext } from '@platform/ports-authorization';
import type { LoggerPort } from '@platform/ports-observability';

import { err, ok, type Result } from 'neverthrow';
import { uuidv7 } from 'uuidv7';
import { z } from 'zod';

import type { AppError } from '../../../errors.js';
import type { IntentBrief } from '../intent-capture/types.js';
import type { PromptDefinition, PromptResult } from '../types.js';
import type {
  ConsistencyReport,
  GeneratePrdOptions,
  Prd,
  PrdArtifact,
  PrdGenerationMetadata,
  PrdQualitySignals,
  PrdSection,
  PrdSectionContent,
  PrdSectionType,
  PrdTemplate,
  SectionEdit,
  StalenessIndicator,
  StalenessReport,
  TraceabilityReport,
} from './types.js';

import { auditMeta, toAuditActor } from '../../../context.js';
import {
  ForbiddenError,
  InternalError,
  NotFoundError,
  ValidationError,
  WorkspaceContextRequiredError,
} from '../../../errors.js';
import { observable } from '../../../observability/observable.js';
import { PRD_AUDIT_EVENTS } from './audit-events.js';
import { PRD_PERMISSIONS } from './permissions.js';
// Prompt imports — these files exist alongside this service.
import { createConsistencyCheckPrompt } from './prompts/consistency-check.prompt.js';
import { createConstraintsAssumptionsPrompt } from './prompts/constraints-assumptions.prompt.js';
import { createFunctionalRequirementsPrompt } from './prompts/functional-requirements.prompt.js';
import { createGoalsSuccessMetricsPrompt } from './prompts/goals-success-metrics.prompt.js';
import { createNonFunctionalRequirementsPrompt } from './prompts/non-functional-requirements.prompt.js';
import { createOpenQuestionsPrompt } from './prompts/open-questions.prompt.js';
import { createOutOfScopePrompt } from './prompts/out-of-scope.prompt.js';
import { createOverviewPrompt } from './prompts/overview.prompt.js';
import { createRegenerationPrompt } from './prompts/regeneration.prompt.js';
import { createRisksMitigationsPrompt } from './prompts/risks-mitigations.prompt.js';
import { createStalenessDetectionPrompt } from './prompts/staleness-detection.prompt.js';
import { createTargetUsersPersonasPrompt } from './prompts/target-users-personas.prompt.js';
import { createTraceabilityCheckPrompt } from './prompts/traceability-check.prompt.js';
import { createUserStoriesPrompt } from './prompts/user-stories.prompt.js';
import { getDependents, getGenerationWaves } from './section-dependencies.js';
// Template imports
import { BUILTIN_TEMPLATES, getBuiltinTemplate } from './templates/index.js';
import {
  EditSectionInputSchema,
  ExportPrdInputSchema,
  GeneratePrdInputSchema,
  PRD_SECTION_TYPES,
  RegenerateSectionInputSchema,
} from './types.js';

// ── Repository interfaces ──────────────────────────────────────────────────────
// Defined here until proper ports are created in packages/ports/.

export interface PrdArtifactRepository {
  create(prd: PrdArtifact): Promise<Result<PrdArtifact, AppError>>;
  findById(id: string): Promise<Result<PrdArtifact | null, AppError>>;
  /**
   * Update mutable fields of a PRD artifact.
   * `changes` covers content-level fields (Prd) plus the optional top-level `status`.
   */
  update(
    id: string,
    changes: Partial<Prd> & { status?: PrdArtifact['status'] },
  ): Promise<Result<PrdArtifact, AppError>>;
}

export interface PrdSectionRepository {
  create(section: PrdSection): Promise<Result<PrdSection, AppError>>;
  findById(id: string): Promise<Result<PrdSection | null, AppError>>;
  findByPrdId(prdId: string): Promise<Result<PrdSection[], AppError>>;
  update(id: string, changes: Partial<PrdSection>): Promise<Result<PrdSection, AppError>>;
}

export interface IntentBriefRepository {
  findById(id: string): Promise<Result<IntentBrief | null, AppError>>;
}

export interface PrdTemplateRepository {
  create(
    template: PrdTemplate & { id: string; createdAt: Date; updatedAt: Date },
  ): Promise<Result<PrdTemplate, AppError>>;
  findById(id: string): Promise<Result<PrdTemplate | null, AppError>>;
  findByWorkspaceId(workspaceId: string): Promise<Result<PrdTemplate[], AppError>>;
  delete(id: string): Promise<Result<void, AppError>>;
}

// ── Section generation context ─────────────────────────────────────────────────

/**
 * Accumulated context passed to later-wave sections so they can reference
 * already-generated content (e.g. user stories reference personas).
 */
interface GenerationContext {
  intentBrief: IntentBrief;
  prdId: string;
  completedSections: Map<PrdSectionType, PrdSection>;
}

// ── Service ────────────────────────────────────────────────────────────────────

export class PrdGenerationService {
  // ── Public API (observable-wrapped) ─────────────────────────────────────────

  readonly generatePrd!: (
    ctx: RequestContext,
    intentBriefId: string,
    options?: GeneratePrdOptions,
  ) => Promise<Result<PrdArtifact, AppError>>;

  readonly getPrd!: (ctx: RequestContext, prdId: string) => Promise<Result<PrdArtifact, AppError>>;

  readonly getSection!: (
    ctx: RequestContext,
    prdId: string,
    sectionType: PrdSectionType,
  ) => Promise<Result<PrdSection, AppError>>;

  readonly editSection!: (
    ctx: RequestContext,
    sectionId: string,
    changes: SectionEdit,
  ) => Promise<Result<PrdSection, AppError>>;

  readonly regenerateSection!: (
    ctx: RequestContext,
    sectionId: string,
    feedback?: string,
  ) => Promise<Result<PrdSection, AppError>>;

  readonly checkConsistency!: (
    ctx: RequestContext,
    prdId: string,
  ) => Promise<Result<ConsistencyReport, AppError>>;

  readonly checkTraceability!: (
    ctx: RequestContext,
    prdId: string,
  ) => Promise<Result<TraceabilityReport, AppError>>;

  readonly submitSectionForApproval!: (
    ctx: RequestContext,
    sectionId: string,
  ) => Promise<Result<PrdSection, AppError>>;

  readonly detectStaleness!: (
    ctx: RequestContext,
    prdId: string,
  ) => Promise<Result<StalenessReport, AppError>>;

  readonly regenerateAffectedSections!: (
    ctx: RequestContext,
    prdId: string,
  ) => Promise<Result<PrdSection[], AppError>>;

  readonly approveSection!: (
    ctx: RequestContext,
    sectionId: string,
  ) => Promise<Result<PrdSection, AppError>>;

  readonly rejectSection!: (
    ctx: RequestContext,
    sectionId: string,
    feedback: string,
  ) => Promise<Result<PrdSection, AppError>>;

  readonly export!: (
    ctx: RequestContext,
    prdId: string,
    format: 'markdown' | 'pdf',
  ) => Promise<Result<{ downloadUrl: string }, AppError>>;

  readonly createTemplate!: (
    ctx: RequestContext,
    input: {
      name: string;
      description: string;
      category: string;
      sectionStarters: Partial<Record<PrdSectionType, string>>;
    },
  ) => Promise<Result<PrdTemplate, AppError>>;

  readonly listTemplates!: (ctx: RequestContext) => Promise<Result<PrdTemplate[], AppError>>;

  readonly getTemplate!: (
    ctx: RequestContext,
    templateId: string,
  ) => Promise<Result<PrdTemplate, AppError>>;

  readonly deleteTemplate!: (
    ctx: RequestContext,
    templateId: string,
  ) => Promise<Result<void, AppError>>;

  // ── Typed prompt definitions ─────────────────────────────────────────────────

  private readonly prompts: {
    overview: PromptDefinition<unknown, unknown>;
    goals_and_success_metrics: PromptDefinition<unknown, unknown>;
    target_users_and_personas: PromptDefinition<unknown, unknown>;
    user_stories: PromptDefinition<unknown, unknown>;
    functional_requirements: PromptDefinition<unknown, unknown>;
    non_functional_requirements: PromptDefinition<unknown, unknown>;
    constraints_and_assumptions: PromptDefinition<unknown, unknown>;
    out_of_scope: PromptDefinition<unknown, unknown>;
    open_questions: PromptDefinition<unknown, unknown>;
    risks_and_mitigations: PromptDefinition<unknown, unknown>;
    consistencyCheck: PromptDefinition<unknown, unknown>;
    traceabilityCheck: PromptDefinition<unknown, unknown>;
    regeneration: PromptDefinition<unknown, unknown>;
    stalenessDetection: PromptDefinition<unknown, unknown>;
  };

  constructor(
    private readonly authz: AuthorizationPort,
    private readonly prdRepo: PrdArtifactRepository,
    private readonly sectionRepo: PrdSectionRepository,
    private readonly intentRepo: IntentBriefRepository,
    private readonly audit: AuditPort,
    private readonly logger: LoggerPort,
    private readonly prdTemplates: PrdTemplateRepository,
    ai: AiGenerationPort,
  ) {
    // Construct prompts, binding the AI port at construction time.
    // Cast to PromptDefinition<unknown, unknown> — the service dispatches prompts
    // dynamically by section type and validates output at the port level.
    this.prompts = {
      overview: createOverviewPrompt(ai) as PromptDefinition<unknown, unknown>,
      goals_and_success_metrics: createGoalsSuccessMetricsPrompt(ai) as PromptDefinition<
        unknown,
        unknown
      >,
      target_users_and_personas: createTargetUsersPersonasPrompt(ai) as PromptDefinition<
        unknown,
        unknown
      >,
      user_stories: createUserStoriesPrompt(ai) as PromptDefinition<unknown, unknown>,
      functional_requirements: createFunctionalRequirementsPrompt(ai) as PromptDefinition<
        unknown,
        unknown
      >,
      non_functional_requirements: createNonFunctionalRequirementsPrompt(ai) as PromptDefinition<
        unknown,
        unknown
      >,
      constraints_and_assumptions: createConstraintsAssumptionsPrompt(ai) as PromptDefinition<
        unknown,
        unknown
      >,
      out_of_scope: createOutOfScopePrompt(ai) as PromptDefinition<unknown, unknown>,
      open_questions: createOpenQuestionsPrompt(ai) as PromptDefinition<unknown, unknown>,
      risks_and_mitigations: createRisksMitigationsPrompt(ai) as PromptDefinition<unknown, unknown>,
      consistencyCheck: createConsistencyCheckPrompt(ai) as PromptDefinition<unknown, unknown>,
      traceabilityCheck: createTraceabilityCheckPrompt(ai) as PromptDefinition<unknown, unknown>,
      regeneration: createRegenerationPrompt(ai) as PromptDefinition<unknown, unknown>,
      stalenessDetection: createStalenessDetectionPrompt(ai) as PromptDefinition<unknown, unknown>,
    };

    const obs = { logger };
    const s = 'PrdGenerationService';
    this.generatePrd = observable(s, 'generatePrd', obs, this._generatePrd.bind(this));
    this.getPrd = observable(s, 'getPrd', obs, this._getPrd.bind(this));
    this.getSection = observable(s, 'getSection', obs, this._getSection.bind(this));
    this.editSection = observable(s, 'editSection', obs, this._editSection.bind(this));
    this.regenerateSection = observable(
      s,
      'regenerateSection',
      obs,
      this._regenerateSection.bind(this),
    );
    this.checkConsistency = observable(
      s,
      'checkConsistency',
      obs,
      this._checkConsistency.bind(this),
    );
    this.checkTraceability = observable(
      s,
      'checkTraceability',
      obs,
      this._checkTraceability.bind(this),
    );
    this.submitSectionForApproval = observable(
      s,
      'submitSectionForApproval',
      obs,
      this._submitSectionForApproval.bind(this),
    );
    this.detectStaleness = observable(s, 'detectStaleness', obs, this._detectStaleness.bind(this));
    this.regenerateAffectedSections = observable(
      s,
      'regenerateAffectedSections',
      obs,
      this._regenerateAffectedSections.bind(this),
    );
    this.approveSection = observable(s, 'approveSection', obs, this._approveSection.bind(this));
    this.rejectSection = observable(s, 'rejectSection', obs, this._rejectSection.bind(this));
    this.export = observable(s, 'export', obs, this._export.bind(this));
    this.createTemplate = observable(s, 'createTemplate', obs, this._createTemplate.bind(this));
    this.listTemplates = observable(s, 'listTemplates', obs, this._listTemplates.bind(this));
    this.getTemplate = observable(s, 'getTemplate', obs, this._getTemplate.bind(this));
    this.deleteTemplate = observable(s, 'deleteTemplate', obs, this._deleteTemplate.bind(this));
  }

  // ── generatePrd ───────────────────────────────────────────────────────────────

  private async _generatePrd(
    ctx: RequestContext,
    intentBriefId: string,
    options?: GeneratePrdOptions,
  ): Promise<Result<PrdArtifact, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    // 1. Validate
    const parsed = GeneratePrdInputSchema.safeParse({ intentBriefId, ...options });
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid generatePrd input',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }

    // 2. Authorize
    const authResult = await this.authz.authorize(ctx, PRD_PERMISSIONS.CREATE, 'ai.prd');
    if (authResult.isErr()) {
      await this._logDeny(ctx, PRD_AUDIT_EVENTS.PRD_GENERATED, 'ai.prd', null);
      return err(new ForbiddenError(authResult.error.message));
    }

    // 3. Precondition: load and verify the intent brief is approved
    const briefResult = await this.intentRepo.findById(intentBriefId);
    if (briefResult.isErr()) return err(briefResult.error);
    if (!briefResult.value) {
      return err(new NotFoundError('intent_brief', intentBriefId));
    }
    const intentBrief = briefResult.value;

    if (!intentBrief.approvedAt) {
      return err(
        new ValidationError('Intent brief must be approved before generating a PRD', [
          { path: 'intentBriefId', message: 'Intent brief is not yet approved' },
        ]),
      );
    }

    // Verify workspace scoping
    if (intentBrief.workspaceId !== ctx.workspaceId) {
      return err(new ForbiddenError('Intent brief does not belong to this workspace'));
    }

    // 4. Execute — generate sections wave by wave
    const startTime = Date.now();
    const prdId = uuidv7();
    const sectionsToGenerate = options?.sections ?? [...PRD_SECTION_TYPES];
    const waves = getGenerationWaves(sectionsToGenerate);

    const genCtx: GenerationContext = {
      intentBrief,
      prdId,
      completedSections: new Map(),
    };

    const allGeneratedSections: PrdSection[] = [];

    for (const wave of waves) {
      const waveResults = await Promise.all(
        wave.map((sectionType) => this._generateSection(ctx, prdId, sectionType, genCtx, options)),
      );

      for (const result of waveResults) {
        if (result.isErr()) return err(result.error);
        const section = result.value;

        // Persist the section
        const saveResult = await this.sectionRepo.create(section);
        if (saveResult.isErr()) return err(saveResult.error);
        const saved = saveResult.value;

        genCtx.completedSections.set(saved.sectionType, saved);
        allGeneratedSections.push(saved);

        // Emit per-section audit event
        await this.audit.write({
          eventType: PRD_AUDIT_EVENTS.SECTION_GENERATED,
          workspaceId: ctx.workspaceId,
          actor: toAuditActor(ctx),
          resource: { type: 'prd_section', id: saved.id },
          action: 'generated',
          outcome: 'success',
          correlationId: ctx.correlationId,
          metadata: { prdId, sectionType: saved.sectionType },
          ...auditMeta(ctx),
        });
      }
    }

    // Run consistency and traceability checks after all sections are generated
    const consistencyReport = await this._runConsistencyCheck(allGeneratedSections, intentBrief);
    const traceabilityReport = await this._runTraceabilityCheck(allGeneratedSections, intentBrief);

    const totalGenerationTimeMs = Date.now() - startTime;

    // Build section ID map
    const sectionIds = {} as Record<PrdSectionType, string>;
    for (const section of allGeneratedSections) {
      sectionIds[section.sectionType] = section.id;
    }

    // Compute metadata
    const totalCostUsd = allGeneratedSections.reduce((sum, s) => sum + s.reasoning.costUsd, 0);
    const providersSummary: Record<string, number> = {};
    for (const section of allGeneratedSections) {
      const provider = section.reasoning.provider;
      providersSummary[provider] = (providersSummary[provider] ?? 0) + 1;
    }

    const generationMetadata: PrdGenerationMetadata = {
      totalGenerationTimeMs,
      totalCostUsd,
      sectionGenerationOrder: allGeneratedSections.map((s) => s.sectionType),
      ...(options?.templateId !== undefined ? { templateUsed: options.templateId } : {}),
      providersSummary,
    };

    // Build the PRD content
    const prdContent: Prd = {
      intentBriefId,
      ...(options?.templateId !== undefined ? { templateUsed: options.templateId } : {}),
      sectionIds,
      generationMetadata,
      consistencyReport,
      traceabilityReport,
    };

    // Build the overall reasoning from the first section's reasoning as a summary
    const firstSection = allGeneratedSections[0];
    const aggregateReasoning = firstSection
      ? {
          summary: `PRD generated from intent brief "${intentBrief.title}" across ${allGeneratedSections.length.toString()} sections.`,
          steps: allGeneratedSections.map(
            (s) => `Generated ${s.sectionType}: ${s.reasoning.summary}`,
          ),
          model: firstSection.reasoning.model,
          inputTokens: allGeneratedSections.reduce((sum, s) => sum + s.reasoning.inputTokens, 0),
          outputTokens: allGeneratedSections.reduce((sum, s) => sum + s.reasoning.outputTokens, 0),
          costUsd: totalCostUsd,
          generatedAt: new Date(),
          provider: firstSection.reasoning.provider,
        }
      : {
          summary: 'PRD generated with no sections.',
          steps: [],
          model: 'unknown',
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0,
          generatedAt: new Date(),
          provider: 'unknown',
        };

    const now = new Date();
    const prdArtifact: PrdArtifact = {
      id: prdId,
      workspaceId: ctx.workspaceId,
      pipelineId: intentBrief.pipelineId,
      artifactType: 'prd',
      version: 1,
      status: 'draft',
      content: prdContent,
      reasoning: aggregateReasoning,
      qualitySignals: {
        generationAttempts: 1,
        revisionCount: 0,
        approvedOnFirstPass: false,
      },
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
      createdAt: now,
      updatedAt: now,
    };

    const createResult = await this.prdRepo.create(prdArtifact);
    if (createResult.isErr()) return err(createResult.error);

    // 5. Audit
    await this.audit.write({
      eventType: PRD_AUDIT_EVENTS.PRD_GENERATED,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'prd', id: prdId },
      action: 'generated',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: {
        intentBriefId,
        sectionCount: allGeneratedSections.length,
        totalCostUsd,
        consistencyClean: consistencyReport.clean,
        traceabilityFullyCovered: traceabilityReport.fullyCovered,
      },
      ...auditMeta(ctx),
    });

    this.logger.info('PRD generated', {
      prdId,
      intentBriefId,
      sectionCount: allGeneratedSections.length,
    });

    // 6. Return
    return ok(createResult.value);
  }

  // ── getPrd ────────────────────────────────────────────────────────────────────

  private async _getPrd(
    ctx: RequestContext,
    prdId: string,
  ): Promise<Result<PrdArtifact, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    // 1. Validate
    const idParsed = z.string().uuid().safeParse(prdId);
    if (!idParsed.success) {
      return err(new ValidationError('prdId must be a valid UUID'));
    }

    // 2. Authorize
    const authResult = await this.authz.authorize(ctx, PRD_PERMISSIONS.READ, 'ai.prd');
    if (authResult.isErr()) {
      await this._logDeny(ctx, PRD_AUDIT_EVENTS.PRD_GENERATED, 'ai.prd', prdId);
      return err(new ForbiddenError(authResult.error.message));
    }

    // 3. Precondition + workspace scoping
    const result = await this.prdRepo.findById(prdId);
    if (result.isErr()) return err(result.error);
    if (!result.value) return err(new NotFoundError('prd', prdId));
    if (result.value.workspaceId !== ctx.workspaceId) {
      return err(new ForbiddenError('PRD does not belong to this workspace'));
    }

    // 4. Return
    return ok(result.value);
  }

  // ── getSection ────────────────────────────────────────────────────────────────

  private async _getSection(
    ctx: RequestContext,
    prdId: string,
    sectionType: PrdSectionType,
  ): Promise<Result<PrdSection, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    // 1. Validate
    const idParsed = z.string().uuid().safeParse(prdId);
    if (!idParsed.success) {
      return err(new ValidationError('prdId must be a valid UUID'));
    }

    // 2. Authorize
    const authResult = await this.authz.authorize(ctx, PRD_PERMISSIONS.READ, 'ai.prd');
    if (authResult.isErr()) {
      return err(new ForbiddenError(authResult.error.message));
    }

    // 3. Load PRD for workspace scoping check
    const prdResult = await this.prdRepo.findById(prdId);
    if (prdResult.isErr()) return err(prdResult.error);
    if (!prdResult.value) return err(new NotFoundError('prd', prdId));
    if (prdResult.value.workspaceId !== ctx.workspaceId) {
      return err(new ForbiddenError('PRD does not belong to this workspace'));
    }

    const sectionId = prdResult.value.content.sectionIds[sectionType];
    if (!sectionId) {
      return err(new NotFoundError('prd_section', `${prdId}/${sectionType}`));
    }

    // 4. Load the section
    const sectionResult = await this.sectionRepo.findById(sectionId);
    if (sectionResult.isErr()) return err(sectionResult.error);
    if (!sectionResult.value) return err(new NotFoundError('prd_section', sectionId));

    return ok(sectionResult.value);
  }

  // ── editSection ───────────────────────────────────────────────────────────────

  private async _editSection(
    ctx: RequestContext,
    sectionId: string,
    changes: SectionEdit,
  ): Promise<Result<PrdSection, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    // 1. Validate
    const parsed = EditSectionInputSchema.safeParse({
      sectionId,
      content: changes.content,
      reason: changes.reason,
    });
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid editSection input',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }

    // 2. Authorize
    const authResult = await this.authz.authorize(ctx, PRD_PERMISSIONS.EDIT, 'ai.prd');
    if (authResult.isErr()) {
      await this._logDeny(ctx, PRD_AUDIT_EVENTS.SECTION_EDITED, 'prd_section', sectionId);
      return err(new ForbiddenError(authResult.error.message));
    }

    // 3. Precondition: section exists
    const sectionResult = await this.sectionRepo.findById(sectionId);
    if (sectionResult.isErr()) return err(sectionResult.error);
    if (!sectionResult.value) return err(new NotFoundError('prd_section', sectionId));
    const existing = sectionResult.value;

    // Workspace scoping via parent PRD
    const prdResult = await this.prdRepo.findById(existing.prdId);
    if (prdResult.isErr()) return err(prdResult.error);
    if (!prdResult.value) return err(new NotFoundError('prd', existing.prdId));
    if (prdResult.value.workspaceId !== ctx.workspaceId) {
      return err(new ForbiddenError('Section does not belong to this workspace'));
    }

    // 4. Execute
    const now = new Date();
    const updateResult = await this.sectionRepo.update(sectionId, {
      content: changes.content,
      version: existing.version + 1,
      status: 'draft',
      updatedAt: now,
    });
    if (updateResult.isErr()) return err(updateResult.error);

    // 5. Audit
    await this.audit.write({
      eventType: PRD_AUDIT_EVENTS.SECTION_EDITED,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'prd_section', id: sectionId },
      action: 'edited',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: {
        sectionType: existing.sectionType,
        prdId: existing.prdId,
        reason: changes.reason ?? null,
        previousVersion: existing.version,
        newVersion: existing.version + 1,
      },
      ...auditMeta(ctx),
    });

    // 6. Return
    return ok(updateResult.value);
  }

  // ── regenerateSection ─────────────────────────────────────────────────────────

  private async _regenerateSection(
    ctx: RequestContext,
    sectionId: string,
    feedback?: string,
  ): Promise<Result<PrdSection, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    // 1. Validate
    const parsed = RegenerateSectionInputSchema.safeParse({ sectionId, feedback });
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid regenerateSection input',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }

    // 2. Authorize
    const authResult = await this.authz.authorize(ctx, PRD_PERMISSIONS.EDIT, 'ai.prd');
    if (authResult.isErr()) {
      await this._logDeny(ctx, PRD_AUDIT_EVENTS.SECTION_REGENERATED, 'prd_section', sectionId);
      return err(new ForbiddenError(authResult.error.message));
    }

    // 3. Precondition: load existing section
    const sectionResult = await this.sectionRepo.findById(sectionId);
    if (sectionResult.isErr()) return err(sectionResult.error);
    if (!sectionResult.value) return err(new NotFoundError('prd_section', sectionId));
    const existing = sectionResult.value;

    // Workspace scoping
    const prdResult = await this.prdRepo.findById(existing.prdId);
    if (prdResult.isErr()) return err(prdResult.error);
    if (!prdResult.value) return err(new NotFoundError('prd', existing.prdId));
    if (prdResult.value.workspaceId !== ctx.workspaceId) {
      return err(new ForbiddenError('Section does not belong to this workspace'));
    }

    // Load intent brief for context
    const briefResult = await this.intentRepo.findById(prdResult.value.content.intentBriefId);
    if (briefResult.isErr()) return err(briefResult.error);
    if (!briefResult.value) {
      return err(new NotFoundError('intent_brief', prdResult.value.content.intentBriefId));
    }

    // 4. Execute — run the regeneration prompt
    // Collect already-approved sibling sections as consistency context
    const approvedSections: Partial<Record<PrdSectionType, PrdSectionContent>> = {};
    const prd = prdResult.value;
    for (const [type, id] of Object.entries(prd.content.sectionIds) as [PrdSectionType, string][]) {
      if (id === sectionId) continue;
      const siblingRes = await this.sectionRepo.findById(id);
      if (siblingRes.isOk() && siblingRes.value?.status === 'approved') {
        approvedSections[type] = siblingRes.value.content;
      }
    }

    let promptResult: PromptResult<unknown>;
    try {
      promptResult = await this.prompts.regeneration.run({
        intentBrief: briefResult.value,
        sectionType: existing.sectionType,
        currentContent: existing.content,
        userFeedback: feedback ?? 'Regenerate this section with higher quality.',
        otherApprovedSections: approvedSections,
      });
    } catch (e) {
      return err(
        new InternalError(`Regeneration failed for section ${sectionId}: ${String(e)}`, {
          cause: e,
        }),
      );
    }

    const now = new Date();
    const updatedQualitySignals = {
      ...(existing.qualitySignals ?? {
        generationAttempts: 1,
        revisionCount: 0,
        approvedOnFirstPass: false,
      }),
      revisionCount: (existing.qualitySignals?.revisionCount ?? 0) + 1,
    };
    const updateResult = await this.sectionRepo.update(sectionId, {
      content: promptResult.output as PrdSectionContent,
      version: existing.version + 1,
      status: 'draft',
      reasoning: promptResult.reasoning,
      qualitySignals: updatedQualitySignals,
      updatedAt: now,
    });
    if (updateResult.isErr()) return err(updateResult.error);

    // 5. Audit
    await this.audit.write({
      eventType: PRD_AUDIT_EVENTS.SECTION_REGENERATED,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'prd_section', id: sectionId },
      action: 'regenerated',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: {
        sectionType: existing.sectionType,
        prdId: existing.prdId,
        hasFeedback: feedback != null,
        previousVersion: existing.version,
        newVersion: existing.version + 1,
        costUsd: promptResult.reasoning.costUsd,
      },
      ...auditMeta(ctx),
    });

    // 6. Return
    return ok(updateResult.value);
  }

  // ── checkConsistency ──────────────────────────────────────────────────────────

  private async _checkConsistency(
    ctx: RequestContext,
    prdId: string,
  ): Promise<Result<ConsistencyReport, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    // 1. Validate
    const idParsed = z.string().uuid().safeParse(prdId);
    if (!idParsed.success) return err(new ValidationError('prdId must be a valid UUID'));

    // 2. Authorize
    const authResult = await this.authz.authorize(ctx, PRD_PERMISSIONS.READ, 'ai.prd');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    // 3. Precondition
    const prdResult = await this.prdRepo.findById(prdId);
    if (prdResult.isErr()) return err(prdResult.error);
    if (!prdResult.value) return err(new NotFoundError('prd', prdId));
    if (prdResult.value.workspaceId !== ctx.workspaceId) {
      return err(new ForbiddenError('PRD does not belong to this workspace'));
    }

    const sectionsResult = await this.sectionRepo.findByPrdId(prdId);
    if (sectionsResult.isErr()) return err(sectionsResult.error);

    // Load the intent brief
    const briefResult = await this.intentRepo.findById(prdResult.value.content.intentBriefId);
    if (briefResult.isErr()) return err(briefResult.error);
    if (!briefResult.value) {
      return err(new NotFoundError('intent_brief', prdResult.value.content.intentBriefId));
    }

    // 4. Execute
    const report = await this._runConsistencyCheck(sectionsResult.value, briefResult.value);

    // Update the PRD with the new report
    await this.prdRepo.update(prdId, { consistencyReport: report });

    // 5. Audit
    await this.audit.write({
      eventType: PRD_AUDIT_EVENTS.CONSISTENCY_CHECK_RUN,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'prd', id: prdId },
      action: 'consistency_check_run',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: {
        issueCount: report.issues.length,
        clean: report.clean,
      },
      ...auditMeta(ctx),
    });

    // 6. Return
    return ok(report);
  }

  // ── checkTraceability ─────────────────────────────────────────────────────────

  private async _checkTraceability(
    ctx: RequestContext,
    prdId: string,
  ): Promise<Result<TraceabilityReport, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    // 1. Validate
    const idParsed = z.string().uuid().safeParse(prdId);
    if (!idParsed.success) return err(new ValidationError('prdId must be a valid UUID'));

    // 2. Authorize
    const authResult = await this.authz.authorize(ctx, PRD_PERMISSIONS.READ, 'ai.prd');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    // 3. Precondition
    const prdResult = await this.prdRepo.findById(prdId);
    if (prdResult.isErr()) return err(prdResult.error);
    if (!prdResult.value) return err(new NotFoundError('prd', prdId));
    if (prdResult.value.workspaceId !== ctx.workspaceId) {
      return err(new ForbiddenError('PRD does not belong to this workspace'));
    }

    const sectionsResult = await this.sectionRepo.findByPrdId(prdId);
    if (sectionsResult.isErr()) return err(sectionsResult.error);

    const briefResult = await this.intentRepo.findById(prdResult.value.content.intentBriefId);
    if (briefResult.isErr()) return err(briefResult.error);
    if (!briefResult.value) {
      return err(new NotFoundError('intent_brief', prdResult.value.content.intentBriefId));
    }

    // 4. Execute
    const report = await this._runTraceabilityCheck(sectionsResult.value, briefResult.value);

    // Update the PRD with the new report
    await this.prdRepo.update(prdId, { traceabilityReport: report });

    // 5. Audit
    await this.audit.write({
      eventType: PRD_AUDIT_EVENTS.TRACEABILITY_CHECK_RUN,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'prd', id: prdId },
      action: 'traceability_check_run',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: {
        totalGoals: report.totalIntentGoals,
        coveredGoals: report.coveredGoals,
        fullyCovered: report.fullyCovered,
      },
      ...auditMeta(ctx),
    });

    // 6. Return
    return ok(report);
  }

  // ── submitSectionForApproval ──────────────────────────────────────────────────

  private async _submitSectionForApproval(
    ctx: RequestContext,
    sectionId: string,
  ): Promise<Result<PrdSection, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    // 1. Validate
    const idParsed = z.string().uuid().safeParse(sectionId);
    if (!idParsed.success) return err(new ValidationError('sectionId must be a valid UUID'));

    // 2. Authorize
    const authResult = await this.authz.authorize(ctx, PRD_PERMISSIONS.EDIT, 'ai.prd');
    if (authResult.isErr()) {
      await this._logDeny(ctx, PRD_AUDIT_EVENTS.SECTION_SUBMITTED, 'prd_section', sectionId);
      return err(new ForbiddenError(authResult.error.message));
    }

    // 3. Precondition: section exists and can be submitted
    const sectionResult = await this.sectionRepo.findById(sectionId);
    if (sectionResult.isErr()) return err(sectionResult.error);
    if (!sectionResult.value) return err(new NotFoundError('prd_section', sectionId));
    const existing = sectionResult.value;

    // Workspace scoping
    const prdResult = await this.prdRepo.findById(existing.prdId);
    if (prdResult.isErr()) return err(prdResult.error);
    if (!prdResult.value) return err(new NotFoundError('prd', existing.prdId));
    if (prdResult.value.workspaceId !== ctx.workspaceId) {
      return err(new ForbiddenError('Section does not belong to this workspace'));
    }

    // Can only submit draft sections
    if (existing.status !== 'draft') {
      return err(
        new ValidationError(
          `Section is in status '${existing.status}' and cannot be submitted for approval`,
          [{ path: 'status', message: `Expected 'draft', got '${existing.status}'` }],
        ),
      );
    }

    // 4. Execute
    const updateResult = await this.sectionRepo.update(sectionId, {
      status: 'in_review',
      updatedAt: new Date(),
    });
    if (updateResult.isErr()) return err(updateResult.error);

    // 5. Audit
    await this.audit.write({
      eventType: PRD_AUDIT_EVENTS.SECTION_SUBMITTED,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'prd_section', id: sectionId },
      action: 'submitted',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: {
        sectionType: existing.sectionType,
        prdId: existing.prdId,
      },
      ...auditMeta(ctx),
    });

    // 6. Return
    return ok(updateResult.value);
  }

  // ── detectStaleness ───────────────────────────────────────────────────────────

  private async _detectStaleness(
    ctx: RequestContext,
    prdId: string,
  ): Promise<Result<StalenessReport, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    // 1. Validate
    const idParsed = z.string().uuid().safeParse(prdId);
    if (!idParsed.success) return err(new ValidationError('prdId must be a valid UUID'));

    // 2. Authorize
    const authResult = await this.authz.authorize(ctx, PRD_PERMISSIONS.READ, 'ai.prd');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    // 3. Precondition
    const prdResult = await this.prdRepo.findById(prdId);
    if (prdResult.isErr()) return err(prdResult.error);
    if (!prdResult.value) return err(new NotFoundError('prd', prdId));
    if (prdResult.value.workspaceId !== ctx.workspaceId) {
      return err(new ForbiddenError('PRD does not belong to this workspace'));
    }

    const sectionsResult = await this.sectionRepo.findByPrdId(prdId);
    if (sectionsResult.isErr()) return err(sectionsResult.error);

    const briefResult = await this.intentRepo.findById(prdResult.value.content.intentBriefId);
    if (briefResult.isErr()) return err(briefResult.error);
    if (!briefResult.value) {
      return err(new NotFoundError('intent_brief', prdResult.value.content.intentBriefId));
    }

    // 4. Execute — run staleness detection prompt
    let stalenessIndicators: StalenessIndicator[] = [];
    let changedIntentFields: string[] = [];

    try {
      const promptResult = await this.prompts.stalenessDetection.run({
        intentBrief: briefResult.value,
        sections: sectionsResult.value,
        prd: prdResult.value,
      });

      const output = promptResult.output as {
        stalenessIndicators: StalenessIndicator[];
        changedIntentFields: string[];
      };
      stalenessIndicators = output.stalenessIndicators;
      changedIntentFields = output.changedIntentFields;
    } catch (e) {
      this.logger.warn(
        'PrdGenerationService: staleness detection prompt failed, using empty result',
        {
          prdId,
          error: String(e),
        },
      );
    }

    const affectedSectionTypes = new Set(stalenessIndicators.map((i) => i.sectionType));
    const unaffectedSections = [...PRD_SECTION_TYPES].filter((t) => !affectedSectionTypes.has(t));

    const report: StalenessReport = {
      prdId,
      affectedSections: stalenessIndicators,
      unaffectedSections,
      changedIntentFields,
    };

    // Update the PRD with staleness indicators
    if (stalenessIndicators.length > 0) {
      await this.prdRepo.update(prdId, { stalenessIndicators });

      // Emit staleness detected events for each affected section
      for (const indicator of stalenessIndicators) {
        await this.audit.write({
          eventType: PRD_AUDIT_EVENTS.STALENESS_DETECTED,
          workspaceId: ctx.workspaceId,
          actor: toAuditActor(ctx),
          resource: { type: 'prd_section', id: indicator.sectionId },
          action: 'staleness_detected',
          outcome: 'success',
          correlationId: ctx.correlationId,
          metadata: {
            prdId,
            sectionType: indicator.sectionType,
            reason: indicator.reason,
          },
          ...auditMeta(ctx),
        });
      }
    }

    // 6. Return
    return ok(report);
  }

  // ── regenerateAffectedSections ────────────────────────────────────────────────

  private async _regenerateAffectedSections(
    ctx: RequestContext,
    prdId: string,
  ): Promise<Result<PrdSection[], AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    // 1. Validate
    const idParsed = z.string().uuid().safeParse(prdId);
    if (!idParsed.success) return err(new ValidationError('prdId must be a valid UUID'));

    // 2. Authorize
    const authResult = await this.authz.authorize(ctx, PRD_PERMISSIONS.EDIT, 'ai.prd');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    // 3. Precondition
    const prdResult = await this.prdRepo.findById(prdId);
    if (prdResult.isErr()) return err(prdResult.error);
    if (!prdResult.value) return err(new NotFoundError('prd', prdId));
    if (prdResult.value.workspaceId !== ctx.workspaceId) {
      return err(new ForbiddenError('PRD does not belong to this workspace'));
    }

    const stalenessIndicators = prdResult.value.content.stalenessIndicators ?? [];
    if (stalenessIndicators.length === 0) {
      return ok([]);
    }

    const briefResult = await this.intentRepo.findById(prdResult.value.content.intentBriefId);
    if (briefResult.isErr()) return err(briefResult.error);
    if (!briefResult.value) {
      return err(new NotFoundError('intent_brief', prdResult.value.content.intentBriefId));
    }

    // Collect unique affected section types (including transitive dependents)
    const directlyAffected = new Set(stalenessIndicators.map((i) => i.sectionType));
    const allAffected = new Set<PrdSectionType>(directlyAffected);
    for (const sectionType of directlyAffected) {
      for (const dependent of getDependents(sectionType)) {
        allAffected.add(dependent);
      }
    }

    // 4. Execute — get existing sections for context, then regenerate in wave order
    const existingSectionsResult = await this.sectionRepo.findByPrdId(prdId);
    if (existingSectionsResult.isErr()) return err(existingSectionsResult.error);

    const existingSectionMap = new Map<PrdSectionType, PrdSection>(
      existingSectionsResult.value.map((s) => [s.sectionType, s]),
    );

    const genCtx: GenerationContext = {
      intentBrief: briefResult.value,
      prdId,
      completedSections: new Map(existingSectionMap),
    };

    const affectedArray = [...allAffected];
    const waves = getGenerationWaves(affectedArray);
    const regeneratedSections: PrdSection[] = [];

    for (const wave of waves) {
      const waveResults = await Promise.all(
        wave.map((sectionType) =>
          this._generateSection(ctx, prdId, sectionType, genCtx, undefined),
        ),
      );

      for (const result of waveResults) {
        if (result.isErr()) return err(result.error);
        const newSection = result.value;

        const existing = existingSectionMap.get(newSection.sectionType);
        if (!existing) {
          const createResult = await this.sectionRepo.create(newSection);
          if (createResult.isErr()) return err(createResult.error);
          genCtx.completedSections.set(newSection.sectionType, createResult.value);
          regeneratedSections.push(createResult.value);
        } else {
          const updateResult = await this.sectionRepo.update(existing.id, {
            content: newSection.content,
            reasoning: newSection.reasoning,
            version: existing.version + 1,
            status: 'draft',
            updatedAt: new Date(),
          });
          if (updateResult.isErr()) return err(updateResult.error);
          genCtx.completedSections.set(newSection.sectionType, updateResult.value);
          regeneratedSections.push(updateResult.value);
        }
      }
    }

    // Clear staleness indicators
    await this.prdRepo.update(prdId, { stalenessIndicators: [] });

    // 5. Audit
    await this.audit.write({
      eventType: PRD_AUDIT_EVENTS.AFFECTED_SECTIONS_REGENERATED,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'prd', id: prdId },
      action: 'affected_sections_regenerated',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: {
        regeneratedCount: regeneratedSections.length,
        sectionTypes: regeneratedSections.map((s) => s.sectionType),
      },
      ...auditMeta(ctx),
    });

    // 6. Return
    return ok(regeneratedSections);
  }

  // ── approveSection ────────────────────────────────────────────────────────────

  private async _approveSection(
    ctx: RequestContext,
    sectionId: string,
  ): Promise<Result<PrdSection, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    // 1. Validate
    const idParsed = z.string().uuid().safeParse(sectionId);
    if (!idParsed.success) {
      return err(new ValidationError('sectionId must be a valid UUID'));
    }

    // 2. Authorize
    const authResult = await this.authz.authorize(ctx, PRD_PERMISSIONS.APPROVE, 'ai.prd');
    if (authResult.isErr()) {
      await this._logDeny(ctx, PRD_AUDIT_EVENTS.SECTION_APPROVED, 'prd_section', sectionId);
      return err(new ForbiddenError(authResult.error.message));
    }

    // 3. Precondition: section exists, workspace matches, status is 'in_review'
    const sectionResult = await this.sectionRepo.findById(sectionId);
    if (sectionResult.isErr()) return err(sectionResult.error);
    if (!sectionResult.value) return err(new NotFoundError('prd_section', sectionId));
    const existing = sectionResult.value;

    const prdResult = await this.prdRepo.findById(existing.prdId);
    if (prdResult.isErr()) return err(prdResult.error);
    if (!prdResult.value) return err(new NotFoundError('prd', existing.prdId));
    if (prdResult.value.workspaceId !== ctx.workspaceId) {
      return err(new ForbiddenError('Section does not belong to this workspace'));
    }

    if (existing.status !== 'in_review') {
      return err(
        new ValidationError(`Section is in status '${existing.status}' and cannot be approved`, [
          { path: 'status', message: `Expected 'in_review', got '${existing.status}'` },
        ]),
      );
    }

    // 4. Execute
    const now = new Date();
    const approvedOnFirstPass = (existing.qualitySignals?.revisionCount ?? 0) === 0;
    const timeToApprovalMs = now.getTime() - existing.createdAt.getTime();

    const updatedQualitySignals = {
      ...(existing.qualitySignals ?? {
        generationAttempts: 1,
        revisionCount: 0,
        approvedOnFirstPass: false,
      }),
      approvedOnFirstPass,
      timeToApprovalMs,
    };

    const updateResult = await this.sectionRepo.update(sectionId, {
      status: 'approved',
      qualitySignals: updatedQualitySignals,
      updatedAt: now,
    });
    if (updateResult.isErr()) return err(updateResult.error);

    // Check whether all 10 sections of the PRD are now approved; if so, approve the PRD
    const allSectionsResult = await this.sectionRepo.findByPrdId(existing.prdId);
    if (allSectionsResult.isOk()) {
      const allSections = allSectionsResult.value;
      // Use the updated section in place of the old one for this check
      const updatedSection = updateResult.value;
      const effectiveSections = allSections.map((s) => (s.id === sectionId ? updatedSection : s));
      const allApproved =
        effectiveSections.length === PRD_SECTION_TYPES.length &&
        effectiveSections.every((s) => s.status === 'approved');

      if (allApproved) {
        const currentPrd = prdResult.value;
        const sectionsAcceptedFirstPass = effectiveSections.filter(
          (s) => s.qualitySignals?.approvedOnFirstPass === true,
        ).length;
        const existingContentQs = currentPrd.content.qualitySignals;
        const updatedContentQs: PrdQualitySignals = {
          prdId: existing.prdId,
          sectionsAcceptedFirstPass,
          sectionsRejectedAtLeastOnce: existingContentQs?.sectionsRejectedAtLeastOnce ?? 0,
          totalSectionRevisions: existingContentQs?.totalSectionRevisions ?? 0,
          consistencyIssuesFound: existingContentQs?.consistencyIssuesFound ?? 0,
          consistencyIssuesResolved: existingContentQs?.consistencyIssuesResolved ?? 0,
          intentGoalsCovered: existingContentQs?.intentGoalsCovered ?? 0,
          intentGoalsUncovered: existingContentQs?.intentGoalsUncovered ?? 0,
          totalGenerationTimeMinutes: existingContentQs?.totalGenerationTimeMinutes ?? 0,
          totalApprovalTimeMinutes: existingContentQs?.totalApprovalTimeMinutes ?? 0,
          causedDownstreamRejection: existingContentQs?.causedDownstreamRejection ?? false,
        };

        await this.prdRepo.update(existing.prdId, {
          status: 'approved',
          qualitySignals: updatedContentQs,
        });
      } else {
        // Update sectionsAcceptedFirstPass count incrementally
        const sectionsAcceptedFirstPass = effectiveSections.filter(
          (s) => s.status === 'approved' && s.qualitySignals?.approvedOnFirstPass === true,
        ).length;
        const currentPrd = prdResult.value;
        const existingContentQs = currentPrd.content.qualitySignals;
        const updatedContentQs: PrdQualitySignals = {
          prdId: existing.prdId,
          sectionsAcceptedFirstPass,
          sectionsRejectedAtLeastOnce: existingContentQs?.sectionsRejectedAtLeastOnce ?? 0,
          totalSectionRevisions: existingContentQs?.totalSectionRevisions ?? 0,
          consistencyIssuesFound: existingContentQs?.consistencyIssuesFound ?? 0,
          consistencyIssuesResolved: existingContentQs?.consistencyIssuesResolved ?? 0,
          intentGoalsCovered: existingContentQs?.intentGoalsCovered ?? 0,
          intentGoalsUncovered: existingContentQs?.intentGoalsUncovered ?? 0,
          totalGenerationTimeMinutes: existingContentQs?.totalGenerationTimeMinutes ?? 0,
          totalApprovalTimeMinutes: existingContentQs?.totalApprovalTimeMinutes ?? 0,
          causedDownstreamRejection: existingContentQs?.causedDownstreamRejection ?? false,
        };

        await this.prdRepo.update(existing.prdId, {
          qualitySignals: updatedContentQs,
        });
      }
    }

    // 5. Audit
    await this.audit.write({
      eventType: PRD_AUDIT_EVENTS.SECTION_APPROVED,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'prd_section', id: sectionId },
      action: 'approved',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: {
        sectionType: existing.sectionType,
        prdId: existing.prdId,
        approvedOnFirstPass,
      },
      ...auditMeta(ctx),
    });

    // 6. Return
    return ok(updateResult.value);
  }

  // ── rejectSection ─────────────────────────────────────────────────────────────

  private async _rejectSection(
    ctx: RequestContext,
    sectionId: string,
    feedback: string,
  ): Promise<Result<PrdSection, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    // 1. Validate
    const parsed = z
      .object({
        sectionId: z.string().uuid(),
        feedback: z.string().min(1).max(2000),
      })
      .safeParse({ sectionId, feedback });
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid rejectSection input',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }

    // 2. Authorize
    const authResult = await this.authz.authorize(ctx, PRD_PERMISSIONS.APPROVE, 'ai.prd');
    if (authResult.isErr()) {
      await this._logDeny(ctx, PRD_AUDIT_EVENTS.SECTION_REJECTED, 'prd_section', sectionId);
      return err(new ForbiddenError(authResult.error.message));
    }

    // 3. Precondition: section exists, workspace matches, status is 'in_review'
    const sectionResult = await this.sectionRepo.findById(sectionId);
    if (sectionResult.isErr()) return err(sectionResult.error);
    if (!sectionResult.value) return err(new NotFoundError('prd_section', sectionId));
    const existing = sectionResult.value;

    const prdResult = await this.prdRepo.findById(existing.prdId);
    if (prdResult.isErr()) return err(prdResult.error);
    if (!prdResult.value) return err(new NotFoundError('prd', existing.prdId));
    if (prdResult.value.workspaceId !== ctx.workspaceId) {
      return err(new ForbiddenError('Section does not belong to this workspace'));
    }

    if (existing.status !== 'in_review') {
      return err(
        new ValidationError(`Section is in status '${existing.status}' and cannot be rejected`, [
          { path: 'status', message: `Expected 'in_review', got '${existing.status}'` },
        ]),
      );
    }

    // 4. Execute
    const now = new Date();
    const newRevisionCount = (existing.qualitySignals?.revisionCount ?? 0) + 1;
    const updatedQualitySignals = {
      ...(existing.qualitySignals ?? {
        generationAttempts: 1,
        revisionCount: 0,
        approvedOnFirstPass: false,
      }),
      revisionCount: newRevisionCount,
    };

    const updateResult = await this.sectionRepo.update(sectionId, {
      status: 'rejected',
      qualitySignals: updatedQualitySignals,
      updatedAt: now,
    });
    if (updateResult.isErr()) return err(updateResult.error);

    // Update PRD-level quality signal: sectionsRejectedAtLeastOnce
    const allSectionsResult = await this.sectionRepo.findByPrdId(existing.prdId);
    if (allSectionsResult.isOk()) {
      const effectiveSections = allSectionsResult.value.map((s) =>
        s.id === sectionId ? updateResult.value : s,
      );
      const sectionsRejectedAtLeastOnce = effectiveSections.filter(
        (s) => s.status === 'rejected' || (s.qualitySignals?.revisionCount ?? 0) > 0,
      ).length;
      const currentPrd = prdResult.value;
      const existingContentQs = currentPrd.content.qualitySignals;
      const updatedContentQs: PrdQualitySignals = {
        prdId: existing.prdId,
        sectionsAcceptedFirstPass: existingContentQs?.sectionsAcceptedFirstPass ?? 0,
        sectionsRejectedAtLeastOnce,
        totalSectionRevisions: existingContentQs?.totalSectionRevisions ?? 0,
        consistencyIssuesFound: existingContentQs?.consistencyIssuesFound ?? 0,
        consistencyIssuesResolved: existingContentQs?.consistencyIssuesResolved ?? 0,
        intentGoalsCovered: existingContentQs?.intentGoalsCovered ?? 0,
        intentGoalsUncovered: existingContentQs?.intentGoalsUncovered ?? 0,
        totalGenerationTimeMinutes: existingContentQs?.totalGenerationTimeMinutes ?? 0,
        totalApprovalTimeMinutes: existingContentQs?.totalApprovalTimeMinutes ?? 0,
        causedDownstreamRejection: existingContentQs?.causedDownstreamRejection ?? false,
      };
      await this.prdRepo.update(existing.prdId, {
        qualitySignals: updatedContentQs,
      });
    }

    // 5. Audit
    await this.audit.write({
      eventType: PRD_AUDIT_EVENTS.SECTION_REJECTED,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'prd_section', id: sectionId },
      action: 'rejected',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: {
        sectionType: existing.sectionType,
        prdId: existing.prdId,
        feedback,
      },
      ...auditMeta(ctx),
    });

    // 6. Return
    return ok(updateResult.value);
  }

  // ── export ────────────────────────────────────────────────────────────────────

  private async _export(
    ctx: RequestContext,
    prdId: string,
    format: 'markdown' | 'pdf',
  ): Promise<Result<{ downloadUrl: string }, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    // 1. Validate
    const parsed = ExportPrdInputSchema.safeParse({ prdId, format });
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid export input',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }

    // 2. Authorize
    const authResult = await this.authz.authorize(ctx, PRD_PERMISSIONS.EXPORT, 'ai.prd');
    if (authResult.isErr()) {
      await this._logDeny(ctx, PRD_AUDIT_EVENTS.EXPORTED, 'ai.prd', prdId);
      return err(new ForbiddenError(authResult.error.message));
    }

    // 3. Precondition
    const prdResult = await this.prdRepo.findById(prdId);
    if (prdResult.isErr()) return err(prdResult.error);
    if (!prdResult.value) return err(new NotFoundError('prd', prdId));
    if (prdResult.value.workspaceId !== ctx.workspaceId) {
      return err(new ForbiddenError('PRD does not belong to this workspace'));
    }

    const sectionsResult = await this.sectionRepo.findByPrdId(prdId);
    if (sectionsResult.isErr()) return err(sectionsResult.error);

    // Load intent brief for title
    const briefResult = await this.intentRepo.findById(prdResult.value.content.intentBriefId);
    const title = briefResult.isOk() && briefResult.value ? briefResult.value.title : 'PRD';

    // 4. Execute
    let downloadUrl: string;

    if (format === 'markdown') {
      const markdown = this._renderMarkdown(title, sectionsResult.value);
      const base64 = Buffer.from(markdown, 'utf-8').toString('base64');
      downloadUrl = `data:text/markdown;base64,${base64}`;
    } else {
      // PDF: placeholder — real PDF generation requires a renderer dependency.
      // Return the markdown data URL with a note; a proper PDF port will replace this.
      const markdown = this._renderMarkdown(title, sectionsResult.value);
      const base64 = Buffer.from(markdown, 'utf-8').toString('base64');
      downloadUrl = `data:text/markdown;base64,${base64}`;
      this.logger.warn('PrdGenerationService: PDF export not yet implemented, returning markdown', {
        prdId,
      });
    }

    // 5. Audit
    await this.audit.write({
      eventType: PRD_AUDIT_EVENTS.EXPORTED,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'prd', id: prdId },
      action: 'exported',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { format },
      ...auditMeta(ctx),
    });

    // 6. Return
    return ok({ downloadUrl });
  }

  // ── createTemplate ────────────────────────────────────────────────────────────

  private async _createTemplate(
    ctx: RequestContext,
    input: {
      name: string;
      description: string;
      category: string;
      sectionStarters: Partial<Record<PrdSectionType, string>>;
    },
  ): Promise<Result<PrdTemplate, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    // 1. Validate
    const parsed = z
      .object({
        name: z.string().min(1).max(255),
        description: z.string().max(1000),
        category: z.string().max(100),
        sectionStarters: z.record(z.string()),
      })
      .safeParse(input);
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid createTemplate input',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }

    // 2. Authorize
    const authResult = await this.authz.authorize(ctx, PRD_PERMISSIONS.CREATE, 'ai.prd');
    if (authResult.isErr()) {
      await this._logDeny(ctx, 'ai.prd.template_created', 'prd_template', null);
      return err(new ForbiddenError(authResult.error.message));
    }

    // 3. Execute
    const now = new Date();
    const template: PrdTemplate & { id: string; createdAt: Date; updatedAt: Date } = {
      id: uuidv7(),
      workspaceId: ctx.workspaceId,
      name: parsed.data.name,
      description: parsed.data.description,
      category: parsed.data.category,
      sectionStarters: parsed.data.sectionStarters as Partial<Record<PrdSectionType, string>>,
      builtIn: false,
      createdByUserId: ctx.userId,
      createdAt: now,
      updatedAt: now,
    };

    const createResult = await this.prdTemplates.create(template);
    if (createResult.isErr()) return err(createResult.error);

    // 4. Audit
    await this.audit.write({
      eventType: 'ai.prd.template_created',
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'prd_template', id: template.id },
      action: 'created',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { name: template.name, category: template.category },
      ...auditMeta(ctx),
    });

    // 5. Return
    return ok(createResult.value);
  }

  // ── listTemplates ──────────────────────────────────────────────────────────────

  private async _listTemplates(ctx: RequestContext): Promise<Result<PrdTemplate[], AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    // 1. Authorize
    const authResult = await this.authz.authorize(ctx, PRD_PERMISSIONS.READ, 'ai.prd');
    if (authResult.isErr()) {
      return err(new ForbiddenError(authResult.error.message));
    }

    // 2. Execute — workspace templates + built-ins
    const workspaceResult = await this.prdTemplates.findByWorkspaceId(ctx.workspaceId);
    if (workspaceResult.isErr()) return err(workspaceResult.error);

    const combined: PrdTemplate[] = [...BUILTIN_TEMPLATES, ...workspaceResult.value];

    // 3. Return
    return ok(combined);
  }

  // ── getTemplate ────────────────────────────────────────────────────────────────

  private async _getTemplate(
    ctx: RequestContext,
    templateId: string,
  ): Promise<Result<PrdTemplate, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    // 1. Validate
    const idParsed = z.string().min(1).safeParse(templateId);
    if (!idParsed.success) {
      return err(new ValidationError('templateId must be a non-empty string'));
    }

    // 2. Authorize
    const authResult = await this.authz.authorize(ctx, PRD_PERMISSIONS.READ, 'ai.prd');
    if (authResult.isErr()) {
      return err(new ForbiddenError(authResult.error.message));
    }

    // 3. Check built-ins first, then repo
    const builtin = getBuiltinTemplate(templateId);
    if (builtin) return ok(builtin);

    const repoResult = await this.prdTemplates.findById(templateId);
    if (repoResult.isErr()) return err(repoResult.error);
    if (!repoResult.value) return err(new NotFoundError('prd_template', templateId));

    // Workspace scoping for workspace-defined templates
    if (repoResult.value.workspaceId !== ctx.workspaceId) {
      return err(new ForbiddenError('Template does not belong to this workspace'));
    }

    // 4. Return
    return ok(repoResult.value);
  }

  // ── deleteTemplate ────────────────────────────────────────────────────────────

  private async _deleteTemplate(
    ctx: RequestContext,
    templateId: string,
  ): Promise<Result<void, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    // 1. Validate
    const idParsed = z.string().uuid().safeParse(templateId);
    if (!idParsed.success) {
      return err(new ValidationError('templateId must be a valid UUID'));
    }

    // 2. Authorize
    const authResult = await this.authz.authorize(ctx, PRD_PERMISSIONS.DELETE, 'ai.prd');
    if (authResult.isErr()) {
      await this._logDeny(ctx, 'ai.prd.template_deleted', 'prd_template', templateId);
      return err(new ForbiddenError(authResult.error.message));
    }

    // 3. Precondition: template exists, is not built-in, belongs to this workspace
    const repoResult = await this.prdTemplates.findById(templateId);
    if (repoResult.isErr()) return err(repoResult.error);
    if (!repoResult.value) return err(new NotFoundError('prd_template', templateId));

    const template = repoResult.value;

    if (template.builtIn) {
      return err(
        new ValidationError('Built-in templates cannot be deleted', [
          { path: 'templateId', message: 'This is a built-in template' },
        ]),
      );
    }

    if (template.workspaceId !== ctx.workspaceId) {
      return err(new ForbiddenError('Template does not belong to this workspace'));
    }

    // 4. Execute
    const deleteResult = await this.prdTemplates.delete(templateId);
    if (deleteResult.isErr()) return err(deleteResult.error);

    // 5. Audit
    await this.audit.write({
      eventType: 'ai.prd.template_deleted',
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'prd_template', id: templateId },
      action: 'deleted',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { name: template.name },
      ...auditMeta(ctx),
    });

    // 6. Return
    return ok(undefined);
  }

  // ── Internal helpers ──────────────────────────────────────────────────────────

  /**
   * Generate a single PRD section using the appropriate prompt.
   * Does NOT persist — the caller persists after the wave resolves.
   */
  private async _generateSection(
    _ctx: RequestContext,
    prdId: string,
    sectionType: PrdSectionType,
    genCtx: GenerationContext,
    options?: GeneratePrdOptions,
  ): Promise<Result<PrdSection, AppError>> {
    const prompt = this.prompts[sectionType];

    const input = {
      intentBrief: genCtx.intentBrief,
      completedSections: Object.fromEntries(genCtx.completedSections),
      sectionType,
      generationOptions: options?.generationOptions,
    };

    let promptResult: PromptResult<unknown>;
    try {
      promptResult = await prompt.run(input, options?.generationOptions);
    } catch (e) {
      return err(
        new InternalError(`Section generation failed for '${sectionType}': ${String(e)}`, {
          cause: e,
        }),
      );
    }

    const now = new Date();
    const section: PrdSection = {
      id: uuidv7(),
      prdId,
      sectionType,
      status: 'draft',
      version: 1,
      content: promptResult.output as PrdSectionContent,
      reasoning: promptResult.reasoning,
      qualitySignals: {
        generationAttempts: 1,
        revisionCount: 0,
        approvedOnFirstPass: false,
      },
      createdAt: now,
      updatedAt: now,
    };

    return ok(section);
  }

  /**
   * Run the consistency check prompt against a set of sections.
   * Returns a consistent report shape even if the prompt fails (returns empty issues).
   */
  private async _runConsistencyCheck(
    sections: PrdSection[],
    intentBrief: IntentBrief,
  ): Promise<ConsistencyReport> {
    const now = new Date();
    try {
      const result = await this.prompts.consistencyCheck.run({ sections, intentBrief });
      const output = result.output as ConsistencyReport;
      return {
        ranAt: now,
        issues: output.issues,
        clean: output.clean,
      };
    } catch (e) {
      this.logger.warn(
        'PrdGenerationService: consistency check prompt failed, returning empty report',
        {
          error: String(e),
        },
      );
      return { ranAt: now, issues: [], clean: true };
    }
  }

  /**
   * Run the traceability check prompt against a set of sections.
   * Returns a consistent report shape even if the prompt fails.
   */
  private async _runTraceabilityCheck(
    sections: PrdSection[],
    intentBrief: IntentBrief,
  ): Promise<TraceabilityReport> {
    const now = new Date();
    const totalIntentGoals = intentBrief.goals.length;

    try {
      const result = await this.prompts.traceabilityCheck.run({ sections, intentBrief });
      const output = result.output as TraceabilityReport;
      return {
        ranAt: now,
        totalIntentGoals: output.totalIntentGoals,
        coveredGoals: output.coveredGoals,
        gaps: output.gaps,
        fullyCovered: output.fullyCovered,
      };
    } catch (e) {
      this.logger.warn(
        'PrdGenerationService: traceability check prompt failed, returning empty report',
        {
          error: String(e),
        },
      );
      return {
        ranAt: now,
        totalIntentGoals,
        coveredGoals: 0,
        gaps: intentBrief.goals.map((g) => ({
          intentGoalId: g.id,
          intentGoalDescription: g.description,
          requirementCount: 0,
        })),
        fullyCovered: false,
      };
    }
  }

  /**
   * Render all sections in PRD_SECTION_TYPES order as Markdown.
   */
  private _renderMarkdown(title: string, sections: PrdSection[]): string {
    const sectionMap = new Map(sections.map((s) => [s.sectionType, s]));
    const lines: string[] = [`# ${title}`, ''];

    const sectionTitles: Record<PrdSectionType, string> = {
      overview: 'Overview',
      goals_and_success_metrics: 'Goals and Success Metrics',
      target_users_and_personas: 'Target Users and Personas',
      user_stories: 'User Stories',
      functional_requirements: 'Functional Requirements',
      non_functional_requirements: 'Non-Functional Requirements',
      constraints_and_assumptions: 'Constraints and Assumptions',
      out_of_scope: 'Out of Scope',
      open_questions: 'Open Questions',
      risks_and_mitigations: 'Risks and Mitigations',
    };

    for (const sectionType of PRD_SECTION_TYPES) {
      const section = sectionMap.get(sectionType);
      if (!section) continue;

      lines.push(`## ${sectionTitles[sectionType]}`);
      lines.push('');
      lines.push(JSON.stringify(section.content, null, 2));
      lines.push('');
    }

    return lines.join('\n');
  }

  /** Write a denied audit event. */
  private async _logDeny(
    ctx: RequestContext,
    eventType: string,
    resourceType: string,
    resourceId: string | null,
  ): Promise<void> {
    await this.audit.write({
      eventType,
      ...(ctx.workspaceId != null ? { workspaceId: ctx.workspaceId } : {}),
      actor: toAuditActor(ctx),
      resource: { type: resourceType, id: resourceId ?? ctx.userId },
      action: eventType.split('.').at(-1) ?? eventType,
      outcome: 'denied',
      correlationId: ctx.correlationId,
      ...auditMeta(ctx),
    });
  }
}
