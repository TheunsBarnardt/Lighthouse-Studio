import {
  ArtifactService,
  ApprovalRoutingEngine,
  CostTrackingService,
  GenerationService,
  PromptService,
  StagePipelineService,
  ToolRegistry,
} from '@platform/core';
import {
  createInMemoryAudit,
  createInMemoryAuthz,
  createInMemoryLogger,
} from '@platform/core/testing';
import {
  createInMemoryAiCache,
  createInMemoryArtifactRepo,
  createInMemoryCostTracking,
} from '@platform/core/testing';

// ── Stub AI provider for dev/test ─────────────────────────────────────────────
// Production wires AnthropicAdapter (or OpenAI/Azure etc.) loaded from env.

const stubProvider = {
  id: 'stub',
  capabilities: {
    streaming: false,
    toolUse: false,
    structuredOutput: false,
    imageInput: false,
    maxContextTokens: 0,
  },
  listModels: () => Promise.resolve({ isOk: () => true, value: [], isErr: () => false } as never),
  generate: () =>
    Promise.resolve({
      isOk: () => false,
      isErr: () => true,
      error: { code: 'PROVIDER_ERROR', message: 'AI provider not configured in this environment' },
    } as never),
  // eslint-disable-next-line @typescript-eslint/require-await
  generateStream: async function* () {
    yield {
      type: 'error' as const,
      code: 'PROVIDER_ERROR',
      message: 'AI provider not configured in this environment',
    };
  },
  countTokens: (_text: string) =>
    Promise.resolve({ isOk: () => true, value: 0, isErr: () => false } as never),
  healthCheck: () =>
    Promise.resolve({
      isOk: () => true,
      value: { healthy: false, message: 'stub provider' },
      isErr: () => false,
    } as never),
};

// ── Lazy singletons ───────────────────────────────────────────────────────────

let _artifactService: ArtifactService | null = null;
let _generationService: GenerationService | null = null;
let _toolRegistry: ToolRegistry | null = null;
let _stagePipeline: StagePipelineService | null = null;

export function getArtifactService(): ArtifactService {
  if (!_artifactService) {
    _artifactService = new ArtifactService(
      createInMemoryAuthz(),
      createInMemoryArtifactRepo(),
      createInMemoryAudit(),
      createInMemoryLogger(),
    );
  }
  return _artifactService;
}

export function getToolRegistry(): ToolRegistry {
  if (!_toolRegistry) {
    _toolRegistry = new ToolRegistry(
      createInMemoryAuthz(),
      createInMemoryAudit(),
      createInMemoryLogger(),
    );
  }
  return _toolRegistry;
}

export function getGenerationService(): GenerationService {
  if (!_generationService) {
    const logger = createInMemoryLogger();
    _generationService = new GenerationService(
      createInMemoryAuthz(),
      [stubProvider],
      new PromptService(createInMemoryAuthz(), createInMemoryAudit(), logger),
      createInMemoryAiCache(),
      new CostTrackingService(
        createInMemoryAuthz(),
        createInMemoryCostTracking(),
        createInMemoryAudit(),
        createInMemoryLogger(),
      ),
      getToolRegistry(),
      createInMemoryAudit(),
      logger,
    );
  }
  return _generationService;
}

export function getStagePipelineService(): StagePipelineService {
  if (!_stagePipeline) {
    _stagePipeline = new StagePipelineService(
      createInMemoryAuthz(),
      getArtifactService(),
      new ApprovalRoutingEngine(),
      createInMemoryAudit(),
      createInMemoryLogger(),
    );
  }
  return _stagePipeline;
}
