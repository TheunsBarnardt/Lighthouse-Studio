import { err, ok, type Result } from 'neverthrow';
import { uuidv7 } from 'uuidv7';

import type { AuditPort } from '@platform/ports-audit';
import type { AuthorizationPort, RequestContext } from '@platform/ports-authorization';
import type { LoggerPort } from '@platform/ports-observability';
import type { RepositoryPort } from '@platform/ports-persistence';

import { ForbiddenError, InternalError, NotFoundError, ValidationError } from '../../errors.js';
import { auditMeta, toAuditActor } from '../../context.js';
import { observable } from '../../observability/observable.js';
import type { ArtifactService } from '../artifact.service.js';
import type { GenerationService } from '../generation.service.js';
import type { StagePipelineService } from '../stage-pipeline.service.js';

// ── Import and register all prd-generation prompts ───────────────────────────
import '../../../ai/prompts/prd-generation/index.js';

import { PRD_AUDIT_EVENTS } from './audit-events.js';
import { PRD_GENERATION_PERMISSIONS } from './permissions.js';
import {
  PRD_SECTION_TYPES,
  SECTION_DEPENDENCIES,
  type ConsistencyReport,
  type GeneratePrdOptions,
  type Prd,
  type PrdSection,
  type PrdSectionType,
  type PrdTemplate,
  type SectionEdit,
  type StalenessReport,
  type TraceabilityReport,
} from './types.js';
import { BUILT_IN_PRD_TEMPLATES, getBuiltInPrdTemplate } from './templates/index.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function topologicalOrder(): PrdSectionType[] {
  const visited = new Set<PrdSectionType>();
  const result: PrdSectionType[] = [];

  function visit(section: PrdSectionType): void {
    if (visited.has(section)) return;
    for (const dep of SECTION_DEPENDENCIES[section]) {
      visit(dep);
    }
    visited.add(section);
    result.push(section);
  }

  for (const s of PRD_SECTION_TYPES) {
    visit(s);
  }
  return result;
}

const GENERATION_ORDER = topologicalOrder();

// ── Service ───────────────────────────────────────────────────────────────────

export interface ListPrdsOptions {
  intentBriefId?: string;
  limit?: number;
  offset?: number;
}

export interface ListPrdTemplatesOptions {
  category?: string;
  includeWorkspace?: boolean;
}

export class PrdGenerationService {
  readonly generatePrd: (
    ctx: RequestContext,
    intentBriefId: string,
    options?: GeneratePrdOptions,
  ) => Promise<Result<Prd, Error>>;

  readonly getPrd: (
    ctx: RequestContext,
    prdId: string,
  ) => Promise<Result<Prd, Error>>;

  readonly getSection: (
    ctx: RequestContext,
    prdId: string,
    sectionType: PrdSectionType,
  ) => Promise<Result<PrdSection, Error>>;

  readonly editSection: (
    ctx: RequestContext,
    prdId: string,
    sectionType: PrdSectionType,
    changes: SectionEdit,
  ) => Promise<Result<PrdSection, Error>>;

  readonly regenerateSection: (
    ctx: RequestContext,
    prdId: string,
    sectionType: PrdSectionType,
    feedback?: string,
  ) => Promise<Result<PrdSection, Error>>;

  readonly submitSectionForApproval: (
    ctx: RequestContext,
    prdId: string,
    sectionType: PrdSectionType,
  ) => Promise<Result<PrdSection, Error>>;

  readonly checkConsistency: (
    ctx: RequestContext,
    prdId: string,
  ) => Promise<Result<ConsistencyReport, Error>>;

  readonly checkTraceability: (
    ctx: RequestContext,
    prdId: string,
  ) => Promise<Result<TraceabilityReport, Error>>;

  readonly detectStaleness: (
    ctx: RequestContext,
    prdId: string,
  ) => Promise<Result<StalenessReport, Error>>;

  readonly regenerateAffectedSections: (
    ctx: RequestContext,
    prdId: string,
  ) => Promise<Result<PrdSection[], Error>>;

  readonly export: (
    ctx: RequestContext,
    prdId: string,
    format: 'markdown',
  ) => Promise<Result<{ content: string }, Error>>;

  readonly listPrds: (
    ctx: RequestContext,
    opts?: ListPrdsOptions,
  ) => Promise<Result<{ items: Prd[]; total: number }, Error>>;

  readonly listTemplates: (
    ctx: RequestContext,
    opts?: ListPrdTemplatesOptions,
  ) => Promise<Result<{ items: PrdTemplate[]; total: number }, Error>>;

  constructor(
    private readonly authz: AuthorizationPort,
    private readonly artifacts: ArtifactService,
    private readonly generation: GenerationService,
    private readonly pipeline: StagePipelineService,
    private readonly templateRepo: RepositoryPort<PrdTemplate>,
    private readonly audit: AuditPort,
    private readonly logger: LoggerPort,
  ) {
    const wrap = <TArgs extends unknown[], TReturn>(
      name: string,
      fn: (...args: TArgs) => Promise<TReturn>,
    ) =>
      observable('PrdGenerationService', name, { logger: this.logger }, fn) as (
        ...args: TArgs
      ) => Promise<TReturn>;

    this.generatePrd = wrap('generatePrd', this._generatePrd.bind(this));
    this.getPrd = wrap('getPrd', this._getPrd.bind(this));
    this.getSection = wrap('getSection', this._getSection.bind(this));
    this.editSection = wrap('editSection', this._editSection.bind(this));
    this.regenerateSection = wrap('regenerateSection', this._regenerateSection.bind(this));
    this.submitSectionForApproval = wrap('submitSectionForApproval', this._submitSectionForApproval.bind(this));
    this.checkConsistency = wrap('checkConsistency', this._checkConsistency.bind(this));
    this.checkTraceability = wrap('checkTraceability', this._checkTraceability.bind(this));
    this.detectStaleness = wrap('detectStaleness', this._detectStaleness.bind(this));
    this.regenerateAffectedSections = wrap('regenerateAffectedSections', this._regenerateAffectedSections.bind(this));
    this.export = wrap('export', this._export.bind(this));
    this.listPrds = wrap('listPrds', this._listPrds.bind(this));
    this.listTemplates = wrap('listTemplates', this._listTemplates.bind(this));
  }

  // ── Generate full PRD ──────────────────────────────────────────────────────

  private async _generatePrd(
    ctx: RequestContext,
    intentBriefId: string,
    options: GeneratePrdOptions = {},
  ): Promise<Result<Prd, Error>> {
    const authzResult = await this.authz.check(ctx, PRD_GENERATION_PERMISSIONS.CREATE);
    if (authzResult.isErr()) return err(new ForbiddenError('ai.prd.create'));

    // Load the intent brief artifact
    const briefResult = await this.artifacts.getById(ctx, intentBriefId);
    if (briefResult.isErr()) return err(new NotFoundError(`Intent brief ${intentBriefId} not found`));
    const intentBrief = briefResult.value;

    if (intentBrief.status !== 'approved') {
      return err(new ValidationError('Intent brief must be approved before generating a PRD'));
    }

    const templateContext = options.templateId
      ? await this._getTemplateContext(options.templateId)
      : undefined;

    const prdId = uuidv7();
    const sections: Record<PrdSectionType, PrdSection | null> = {} as Record<PrdSectionType, PrdSection | null>;
    for (const s of PRD_SECTION_TYPES) sections[s] = null;

    const intentBriefJson = JSON.stringify(intentBrief.content);
    let totalCostUsd = 0;

    // Generate sections in dependency order; collect completed sections for downstream use
    const completedSections: Partial<Record<PrdSectionType, PrdSection>> = {};

    for (const sectionType of GENERATION_ORDER) {
      const sectionResult = await this._generateSection(
        ctx,
        prdId,
        sectionType,
        intentBriefJson,
        completedSections,
        templateContext,
      );
      if (sectionResult.isErr()) {
        this.logger.warn(`PRD section ${sectionType} generation failed`, { error: sectionResult.error });
        continue;
      }
      sections[sectionType] = sectionResult.value;
      completedSections[sectionType] = sectionResult.value;
      totalCostUsd += 0; // cost tracked per generation call in GenerationService
    }

    const prd: Prd = {
      intentBriefId,
      templateUsed: options.templateId,
      sections,
      isFullyApproved: false,
      totalGenerationCostUsd: totalCostUsd,
    };

    const storeResult = await this.artifacts.create(ctx, {
      stage: 'prd_generation',
      type: 'prd',
      content: prd,
      reasoning: { rationale: 'PRD generated from approved intent brief', alternativesConsidered: [], assumptions: [], uncertainties: [], sourceArtifactIds: [intentBriefId] },
      parentArtifactIds: [intentBriefId],
    });
    if (storeResult.isErr()) return err(new InternalError('Failed to store PRD artifact'));

    await this.audit.write({
      eventType: PRD_AUDIT_EVENTS.PRD_GENERATED,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'prd', id: storeResult.value.id },
      action: 'prd_generated',
      outcome: 'success',
      metadata: { ...auditMeta(ctx), intentBriefId, sectionsGenerated: Object.keys(completedSections).length },
      correlationId: ctx.correlationId,
    });

    return ok(prd);
  }

  private async _generateSection(
    ctx: RequestContext,
    prdId: string,
    sectionType: PrdSectionType,
    intentBriefJson: string,
    completedSections: Partial<Record<PrdSectionType, PrdSection>>,
    templateContext?: string,
  ): Promise<Result<PrdSection, Error>> {
    const promptId = `prd-generation/${sectionType.replace(/_/g, '-')}`;
    const inputs = this._buildSectionInputs(sectionType, intentBriefJson, completedSections, templateContext);

    const genResult = await this.generation.generate(ctx, { promptId, inputs, stage: 'prd_generation' });
    if (genResult.isErr()) return err(genResult.error);

    const section: PrdSection = {
      id: uuidv7(),
      prdId,
      sectionType,
      status: 'draft',
      currentVersion: 1,
      content: genResult.value.structuredOutput as PrdSection['content'],
      reasoning: genResult.value.reasoning ?? '',
      qualitySignals: { generationAttempts: 1, approvedOnFirstPass: false, revisionCount: 0 },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.audit.write({
      eventType: PRD_AUDIT_EVENTS.SECTION_GENERATED,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'prd_section', id: section.id },
      action: 'section_generated',
      outcome: 'success',
      metadata: { ...auditMeta(ctx), prdId, sectionType },
      correlationId: ctx.correlationId,
    });

    return ok(section);
  }

  private _buildSectionInputs(
    sectionType: PrdSectionType,
    intentBriefJson: string,
    completedSections: Partial<Record<PrdSectionType, PrdSection>>,
    templateContext?: string,
  ): Record<string, unknown> {
    const s = (t: PrdSectionType) => completedSections[t] ? JSON.stringify(completedSections[t]!.content) : '{}';

    const base: Record<string, unknown> = { intentBriefJson };
    if (templateContext) base['templateContext'] = templateContext;

    switch (sectionType) {
      case 'purpose': return base;
      case 'scope': return { ...base, purposeSectionJson: s('purpose') };
      case 'locked_decisions': return { ...base, purposeSectionJson: s('purpose') };
      case 'hard_parts': return { intentBriefJson, lockedDecisionsSectionJson: s('locked_decisions') };
      case 'component_specifications': return { intentBriefJson, lockedDecisionsSectionJson: s('locked_decisions'), scopeSectionJson: s('scope') };
      case 'architectural_overview': return { intentBriefJson, lockedDecisionsSectionJson: s('locked_decisions'), componentSpecsSectionJson: s('component_specifications') };
      case 'implementation_order': return { componentSpecsSectionJson: s('component_specifications'), hardPartsSectionJson: s('hard_parts') };
      case 'adrs_to_write': return { lockedDecisionsSectionJson: s('locked_decisions'), hardPartsSectionJson: s('hard_parts') };
      case 'verification_steps': return { intentBriefJson, componentSpecsSectionJson: s('component_specifications') };
      case 'definition_of_done': return { componentSpecsSectionJson: s('component_specifications'), verificationStepsSectionJson: s('verification_steps') };
      case 'anti_patterns': return { intentBriefJson, lockedDecisionsSectionJson: s('locked_decisions'), scopeSectionJson: s('scope') };
      case 'open_questions': return { intentBriefJson, componentSpecsSectionJson: s('component_specifications'), hardPartsSectionJson: s('hard_parts') };
      case 'what_comes_next': return { definitionOfDoneSectionJson: s('definition_of_done'), implementationOrderSectionJson: s('implementation_order') };
      default: return base;
    }
  }

  // ── Get / list ─────────────────────────────────────────────────────────────

  private async _getPrd(ctx: RequestContext, prdId: string): Promise<Result<Prd, Error>> {
    const authzResult = await this.authz.check(ctx, PRD_GENERATION_PERMISSIONS.READ);
    if (authzResult.isErr()) return err(new ForbiddenError('ai.prd.read'));

    const result = await this.artifacts.getById(ctx, prdId);
    if (result.isErr()) return err(new NotFoundError(`PRD ${prdId} not found`));
    return ok(result.value.content as Prd);
  }

  private async _getSection(ctx: RequestContext, prdId: string, sectionType: PrdSectionType): Promise<Result<PrdSection, Error>> {
    const prdResult = await this._getPrd(ctx, prdId);
    if (prdResult.isErr()) return err(prdResult.error);
    const section = prdResult.value.sections[sectionType];
    if (!section) return err(new NotFoundError(`Section ${sectionType} not generated yet`));
    return ok(section);
  }

  private async _listPrds(ctx: RequestContext, opts: ListPrdsOptions = {}): Promise<Result<{ items: Prd[]; total: number }, Error>> {
    const authzResult = await this.authz.check(ctx, PRD_GENERATION_PERMISSIONS.READ);
    if (authzResult.isErr()) return err(new ForbiddenError('ai.prd.read'));

    const result = await this.artifacts.list(ctx, { stage: 'prd_generation', type: 'prd', ...opts });
    if (result.isErr()) return err(result.error);
    return ok({ items: result.value.items.map((a) => a.content as Prd), total: result.value.total });
  }

  // ── Edit / regenerate ──────────────────────────────────────────────────────

  private async _editSection(ctx: RequestContext, prdId: string, sectionType: PrdSectionType, changes: SectionEdit): Promise<Result<PrdSection, Error>> {
    const authzResult = await this.authz.check(ctx, PRD_GENERATION_PERMISSIONS.EDIT);
    if (authzResult.isErr()) return err(new ForbiddenError('ai.prd.edit'));

    const sectionResult = await this._getSection(ctx, prdId, sectionType);
    if (sectionResult.isErr()) return err(sectionResult.error);

    const updated: PrdSection = {
      ...sectionResult.value,
      content: { ...sectionResult.value.content, ...changes.content } as PrdSection['content'],
      currentVersion: sectionResult.value.currentVersion + 1,
      status: 'draft',
      updatedAt: new Date(),
    };

    await this.audit.write({
      eventType: PRD_AUDIT_EVENTS.SECTION_EDITED,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'prd_section', id: updated.id },
      action: 'section_edited',
      outcome: 'success',
      metadata: { ...auditMeta(ctx), prdId, sectionType },
      correlationId: ctx.correlationId,
    });

    return ok(updated);
  }

  private async _regenerateSection(ctx: RequestContext, prdId: string, sectionType: PrdSectionType, feedback?: string): Promise<Result<PrdSection, Error>> {
    const authzResult = await this.authz.check(ctx, PRD_GENERATION_PERMISSIONS.EDIT);
    if (authzResult.isErr()) return err(new ForbiddenError('ai.prd.edit'));

    const prdResult = await this._getPrd(ctx, prdId);
    if (prdResult.isErr()) return err(prdResult.error);

    const currentSection = prdResult.value.sections[sectionType];
    if (!currentSection) return err(new NotFoundError(`Section ${sectionType} not found`));

    const briefId = prdResult.value.intentBriefId;
    const briefResult = await this.artifacts.getById(ctx, briefId);
    if (briefResult.isErr()) return err(new NotFoundError(`Intent brief ${briefId} not found`));

    const approvedSections = Object.entries(prdResult.value.sections)
      .filter(([t, s]) => t !== sectionType && s?.status === 'approved')
      .reduce<Record<string, unknown>>((acc, [t, s]) => { acc[t] = s!.content; return acc; }, {});

    const genResult = await this.generation.generate(ctx, {
      promptId: 'prd-generation/regeneration',
      inputs: {
        sectionType,
        currentSectionJson: JSON.stringify(currentSection.content),
        userFeedback: feedback ?? '',
        intentBriefJson: JSON.stringify(briefResult.value.content),
        otherApprovedSectionsJson: JSON.stringify(approvedSections),
      },
      stage: 'prd_generation',
    });
    if (genResult.isErr()) return err(genResult.error);

    const revised: PrdSection = {
      ...currentSection,
      content: (genResult.value.structuredOutput as { revisedContent: PrdSection['content'] }).revisedContent,
      currentVersion: currentSection.currentVersion + 1,
      status: 'draft',
      reasoning: genResult.value.reasoning ?? '',
      updatedAt: new Date(),
      qualitySignals: currentSection.qualitySignals
        ? { ...currentSection.qualitySignals, generationAttempts: currentSection.qualitySignals.generationAttempts + 1, revisionCount: currentSection.qualitySignals.revisionCount + 1 }
        : { generationAttempts: 2, approvedOnFirstPass: false, revisionCount: 1 },
    };

    await this.audit.write({
      eventType: PRD_AUDIT_EVENTS.SECTION_REGENERATED,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'prd_section', id: revised.id },
      action: 'section_regenerated',
      outcome: 'success',
      metadata: { ...auditMeta(ctx), prdId, sectionType, hasFeedback: !!feedback },
      correlationId: ctx.correlationId,
    });

    return ok(revised);
  }

  // ── Approval ───────────────────────────────────────────────────────────────

  private async _submitSectionForApproval(ctx: RequestContext, prdId: string, sectionType: PrdSectionType): Promise<Result<PrdSection, Error>> {
    const authzResult = await this.authz.check(ctx, PRD_GENERATION_PERMISSIONS.APPROVE);
    if (authzResult.isErr()) return err(new ForbiddenError('ai.prd.approve'));

    const sectionResult = await this._getSection(ctx, prdId, sectionType);
    if (sectionResult.isErr()) return err(sectionResult.error);

    const submitted: PrdSection = {
      ...sectionResult.value,
      status: 'approved',
      approvedByUserId: ctx.userId,
      approvedAt: new Date(),
      updatedAt: new Date(),
      qualitySignals: sectionResult.value.qualitySignals
        ? {
            ...sectionResult.value.qualitySignals,
            approvedOnFirstPass: sectionResult.value.qualitySignals.revisionCount === 0,
            approvalTimeMs: Date.now() - sectionResult.value.createdAt.getTime(),
          }
        : { generationAttempts: 1, approvedOnFirstPass: true, revisionCount: 0 },
    };

    await this.audit.write({
      eventType: PRD_AUDIT_EVENTS.SECTION_APPROVED,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'prd_section', id: submitted.id },
      action: 'section_approved',
      outcome: 'success',
      metadata: { ...auditMeta(ctx), prdId, sectionType },
      correlationId: ctx.correlationId,
    });

    return ok(submitted);
  }

  // ── Consistency + traceability ─────────────────────────────────────────────

  private async _checkConsistency(ctx: RequestContext, prdId: string): Promise<Result<ConsistencyReport, Error>> {
    const authzResult = await this.authz.check(ctx, PRD_GENERATION_PERMISSIONS.READ);
    if (authzResult.isErr()) return err(new ForbiddenError('ai.prd.read'));

    const prdResult = await this._getPrd(ctx, prdId);
    if (prdResult.isErr()) return err(prdResult.error);

    const sectionContents = Object.fromEntries(
      Object.entries(prdResult.value.sections).filter(([, s]) => s !== null).map(([t, s]) => [t, s!.content]),
    );

    const genResult = await this.generation.generate(ctx, {
      promptId: 'prd-generation/consistency-check',
      inputs: { prdSectionsJson: JSON.stringify(sectionContents) },
      stage: 'prd_generation',
    });
    if (genResult.isErr()) return err(genResult.error);

    const output = genResult.value.structuredOutput as { issues: ConsistencyReport['issues'] };
    const report: ConsistencyReport = { prdId, issues: output.issues, checkedAt: new Date() };

    await this.audit.write({
      eventType: output.issues.length > 0 ? PRD_AUDIT_EVENTS.CONSISTENCY_ISSUE_DETECTED : PRD_AUDIT_EVENTS.CONSISTENCY_CHECK_RUN,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'prd', id: prdId },
      action: 'consistency_check_run',
      outcome: 'success',
      metadata: { ...auditMeta(ctx), issueCount: output.issues.length },
      correlationId: ctx.correlationId,
    });

    return ok(report);
  }

  private async _checkTraceability(ctx: RequestContext, prdId: string): Promise<Result<TraceabilityReport, Error>> {
    const authzResult = await this.authz.check(ctx, PRD_GENERATION_PERMISSIONS.READ);
    if (authzResult.isErr()) return err(new ForbiddenError('ai.prd.read'));

    const prdResult = await this._getPrd(ctx, prdId);
    if (prdResult.isErr()) return err(prdResult.error);

    const briefResult = await this.artifacts.getById(ctx, prdResult.value.intentBriefId);
    if (briefResult.isErr()) return err(new NotFoundError('Intent brief not found'));

    const sectionContents = Object.fromEntries(
      Object.entries(prdResult.value.sections).filter(([, s]) => s !== null).map(([t, s]) => [t, s!.content]),
    );

    const genResult = await this.generation.generate(ctx, {
      promptId: 'prd-generation/traceability-check',
      inputs: {
        intentBriefJson: JSON.stringify(briefResult.value.content),
        prdSectionsJson: JSON.stringify(sectionContents),
      },
      stage: 'prd_generation',
    });
    if (genResult.isErr()) return err(genResult.error);

    const output = genResult.value.structuredOutput as { coveredGoals: number; totalGoals: number; gaps: TraceabilityReport['gaps'] };
    const report: TraceabilityReport = { prdId, ...output, checkedAt: new Date() };

    await this.audit.write({
      eventType: PRD_AUDIT_EVENTS.TRACEABILITY_CHECK_RUN,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'prd', id: prdId },
      action: 'traceability_check_run',
      outcome: 'success',
      metadata: { ...auditMeta(ctx), coveredGoals: output.coveredGoals, totalGoals: output.totalGoals, gapCount: output.gaps.length },
      correlationId: ctx.correlationId,
    });

    return ok(report);
  }

  // ── Staleness ──────────────────────────────────────────────────────────────

  private async _detectStaleness(ctx: RequestContext, prdId: string): Promise<Result<StalenessReport, Error>> {
    const authzResult = await this.authz.check(ctx, PRD_GENERATION_PERMISSIONS.READ);
    if (authzResult.isErr()) return err(new ForbiddenError('ai.prd.read'));

    const prdResult = await this._getPrd(ctx, prdId);
    if (prdResult.isErr()) return err(prdResult.error);

    const briefResult = await this.artifacts.getById(ctx, prdResult.value.intentBriefId);
    if (briefResult.isErr()) return err(new NotFoundError('Intent brief not found'));

    const sectionContents = Object.fromEntries(
      Object.entries(prdResult.value.sections).filter(([, s]) => s !== null).map(([t, s]) => [t, s!.content]),
    );

    const genResult = await this.generation.generate(ctx, {
      promptId: 'prd-generation/staleness-detection',
      inputs: {
        originalIntentBriefJson: JSON.stringify(briefResult.value.content),
        updatedIntentBriefJson: JSON.stringify(briefResult.value.content),
        prdSectionsJson: JSON.stringify(sectionContents),
      },
      stage: 'prd_generation',
    });
    if (genResult.isErr()) return err(genResult.error);

    const output = genResult.value.structuredOutput as { isStale: boolean; indicators: StalenessReport['indicators'] };
    const report: StalenessReport = { prdId, ...output, detectedAt: new Date() };

    if (output.isStale) {
      await this.audit.write({
        eventType: PRD_AUDIT_EVENTS.STALENESS_DETECTED,
        workspaceId: ctx.workspaceId,
        actor: toAuditActor(ctx),
        resource: { type: 'prd', id: prdId },
        action: 'staleness_detected',
        outcome: 'success',
        metadata: { ...auditMeta(ctx), affectedSections: output.indicators.length },
        correlationId: ctx.correlationId,
      });
    }

    return ok(report);
  }

  private async _regenerateAffectedSections(ctx: RequestContext, prdId: string): Promise<Result<PrdSection[], Error>> {
    const authzResult = await this.authz.check(ctx, PRD_GENERATION_PERMISSIONS.EDIT);
    if (authzResult.isErr()) return err(new ForbiddenError('ai.prd.edit'));

    const stalenessResult = await this._detectStaleness(ctx, prdId);
    if (stalenessResult.isErr()) return err(stalenessResult.error);

    if (!stalenessResult.value.isStale) return ok([]);

    const prdResult = await this._getPrd(ctx, prdId);
    if (prdResult.isErr()) return err(prdResult.error);

    const briefResult = await this.artifacts.getById(ctx, prdResult.value.intentBriefId);
    if (briefResult.isErr()) return err(new NotFoundError('Intent brief not found'));

    const affectedTypes = new Set(stalenessResult.value.indicators.map((i) => i.sectionType as PrdSectionType));
    const regenerated: PrdSection[] = [];
    const completedSections: Partial<Record<PrdSectionType, PrdSection>> = {};

    // Seed with non-affected approved sections
    for (const [t, s] of Object.entries(prdResult.value.sections) as [PrdSectionType, PrdSection | null][]) {
      if (s && !affectedTypes.has(t)) completedSections[t] = s;
    }

    for (const sectionType of GENERATION_ORDER) {
      if (!affectedTypes.has(sectionType)) continue;
      const result = await this._generateSection(ctx, prdId, sectionType, JSON.stringify(briefResult.value.content), completedSections);
      if (result.isOk()) {
        regenerated.push(result.value);
        completedSections[sectionType] = result.value;
      }
    }

    await this.audit.write({
      eventType: PRD_AUDIT_EVENTS.AFFECTED_SECTIONS_REGENERATED,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'prd', id: prdId },
      action: 'affected_sections_regenerated',
      outcome: 'success',
      metadata: { ...auditMeta(ctx), count: regenerated.length },
      correlationId: ctx.correlationId,
    });

    return ok(regenerated);
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  private async _export(ctx: RequestContext, prdId: string, format: 'markdown'): Promise<Result<{ content: string }, Error>> {
    const authzResult = await this.authz.check(ctx, PRD_GENERATION_PERMISSIONS.EXPORT);
    if (authzResult.isErr()) return err(new ForbiddenError('ai.prd.export'));

    const prdResult = await this._getPrd(ctx, prdId);
    if (prdResult.isErr()) return err(prdResult.error);

    const lines: string[] = [];
    const sectionTitles: Record<PrdSectionType, string> = {
      purpose: '1. Purpose',
      scope: '2. Scope',
      locked_decisions: '3. Locked Decisions',
      architectural_overview: '4. Architectural Overview',
      hard_parts: '5. The Hard Parts',
      component_specifications: '6. Component Specifications',
      implementation_order: '7. Implementation Order',
      adrs_to_write: '8. ADRs to Write',
      verification_steps: '9. Verification Steps',
      definition_of_done: '10. Definition of Done',
      anti_patterns: '11. Anti-Patterns to Refuse',
      open_questions: '12. Open Questions',
      what_comes_next: '13. What Comes Next',
    };

    lines.push('# Product Requirements Document\n');

    for (const sectionType of PRD_SECTION_TYPES) {
      const section = prdResult.value.sections[sectionType];
      lines.push(`## ${sectionTitles[sectionType]}\n`);
      if (!section) {
        lines.push('_Section not yet generated._\n');
      } else {
        lines.push(JSON.stringify(section.content, null, 2));
        lines.push('');
      }
    }

    await this.audit.write({
      eventType: PRD_AUDIT_EVENTS.EXPORTED,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'prd', id: prdId },
      action: 'exported',
      outcome: 'success',
      metadata: { ...auditMeta(ctx), format },
      correlationId: ctx.correlationId,
    });

    return ok({ content: lines.join('\n') });
  }

  // ── Templates ──────────────────────────────────────────────────────────────

  private async _listTemplates(ctx: RequestContext, opts: ListPrdTemplatesOptions = {}): Promise<Result<{ items: PrdTemplate[]; total: number }, Error>> {
    const authzResult = await this.authz.check(ctx, PRD_GENERATION_PERMISSIONS.READ);
    if (authzResult.isErr()) return err(new ForbiddenError('ai.prd.read'));

    const builtIn = opts.category
      ? BUILT_IN_PRD_TEMPLATES.filter((t) => t.category === opts.category)
      : [...BUILT_IN_PRD_TEMPLATES];

    return ok({ items: builtIn, total: builtIn.length });
  }

  private async _getTemplateContext(templateId: string): Promise<string | undefined> {
    const template = getBuiltInPrdTemplate(templateId);
    if (!template) return undefined;
    return Object.entries(template.sectionStarters)
      .map(([type, hint]) => `[${type}]: ${hint}`)
      .join('\n');
  }
}
