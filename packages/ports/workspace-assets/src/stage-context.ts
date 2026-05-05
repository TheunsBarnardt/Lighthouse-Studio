import type { ConsumedAssetSnapshot, ContextualAsset, StageAssetContext } from './types.js';

/**
 * Declarative stage-to-asset-category bindings (ADR-0227).
 *
 * Each pipeline stage imports its key and passes it to
 * WorkspaceAssetPort.listByContext(). Direct calls to listByCategory()
 * outside the service layer are disallowed by the
 * platform/no-adhoc-asset-category ESLint rule.
 */
export const STAGE_ASSET_CONTEXT = {
  stage2_prd: {
    documents: ['voice', 'strategy', 'reference'],
  },
  stage3_design_tokens: {
    brand: ['logos', 'colors', 'fonts'],
    documents: ['voice'],
  },
  stage6_ui_generation: {
    brand: ['logos', 'colors', 'fonts', 'images', 'icons'],
    documents: ['voice', 'reference'],
  },
  stage7_code_generation: {
    documents: ['compliance', 'specs'],
  },
} as const satisfies Record<string, StageAssetContext>;

export type StageKey = keyof typeof STAGE_ASSET_CONTEXT;

/**
 * Token budgets per stage for document context assembly (ADR-0228).
 */
export const STAGE_DOCUMENT_TOKEN_BUDGET: Record<StageKey, number> = {
  stage2_prd: 16_000,
  stage3_design_tokens: 4_000,
  stage6_ui_generation: 8_000,
  stage7_code_generation: 12_000,
};

/**
 * Build a ConsumedAssetSnapshot from the assets returned by listByContext.
 * Call this immediately after listByContext returns and store the result
 * alongside the generation record so staleness can be checked later (ADR-0228).
 */
export function buildConsumedSnapshot(assets: ContextualAsset[]): ConsumedAssetSnapshot {
  const snapshot: ConsumedAssetSnapshot = {};
  for (const asset of assets) {
    snapshot[asset.id] = {
      version: asset.version,
      category: asset.category,
      filename: asset.filename,
      topLevel: asset.topLevel,
    };
  }
  return snapshot;
}

/**
 * Provenance separator template for wrapping documents in the context window.
 */
export function documentProvenance(
  assetId: string,
  category: string,
  role: string | null,
  updatedAt: Date,
): { open: string; close: string } {
  const slot = role ? `${category}/${role}` : category;
  return {
    open: `--- BEGIN DOCUMENT: ${assetId} | ${slot} | updated ${updatedAt.toISOString()} ---`,
    close: `--- END DOCUMENT ---`,
  };
}
