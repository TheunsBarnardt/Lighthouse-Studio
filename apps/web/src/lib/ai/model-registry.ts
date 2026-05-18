/**
 * Front-end model registry — the menu of models a user can pick from when
 * chatting with the AI (intent capture, PRD generation, etc.).
 *
 * This is purely the *catalog*. Wiring a chosen model to actual prompt
 * execution lives in the AI service layer (`packages/core/src/ai/`) and the
 * route handlers that forward the `model` field to `providerOverride`.
 *
 * Tier badges (`$`, `$$`, `$$$`, `$$$+`) are display hints, not authoritative
 * pricing. The real cost meter is computed from token counts after each call.
 */

export type ModelTier = '$' | '$$' | '$$$' | '$$$+';

export type ModelProvider =
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'meta'
  | 'mistral'
  | 'moonshot'
  | 'deepseek'
  | 'xai';

export type ModelCapability = 'vision' | 'web' | 'reasoning' | 'tools';

export interface ModelEntry {
  /** Stable ID used in API payloads and provider routing. */
  id: string;
  /** Display name shown in the picker. */
  name: string;
  provider: ModelProvider;
  /** One-line description shown in the picker. */
  tagline: string;
  tier: ModelTier;
  capabilities: ModelCapability[];
  /** Marked as the default starred recommendation. Only one true at a time. */
  starred?: boolean;
  /** If true the model is gated behind a paid plan; UI shows the upgrade chip. */
  paid?: boolean;
  /** If true the model is hidden behind the "Legacy" expander. */
  legacy?: boolean;
}

export const MODELS: ModelEntry[] = [
  // Anthropic
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    tagline: 'Anthropic Sonnet for real-world work',
    tier: '$$$',
    capabilities: ['vision', 'web', 'tools'],
    starred: true,
  },
  {
    id: 'claude-opus-4-7',
    name: 'Claude Opus 4.7',
    provider: 'anthropic',
    tagline: "Anthropic's frontier Opus model",
    tier: '$$$+',
    capabilities: ['vision', 'web', 'reasoning', 'tools'],
    paid: true,
  },
  {
    id: 'claude-opus-4-6',
    name: 'Claude Opus 4.6',
    provider: 'anthropic',
    tagline: 'The pinnacle of Claude intelligence',
    tier: '$$$+',
    capabilities: ['vision', 'web', 'reasoning', 'tools'],
    paid: true,
  },
  {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    tagline: 'Lightning-fast responses with surprising depth',
    tier: '$$',
    capabilities: ['vision', 'tools'],
  },
  // OpenAI
  {
    id: 'gpt-5',
    name: 'GPT-5',
    provider: 'openai',
    tagline: "OpenAI's latest general model",
    tier: '$$$',
    capabilities: ['vision', 'web', 'tools'],
  },
  {
    id: 'gpt-5-mini',
    name: 'GPT-5 mini',
    provider: 'openai',
    tagline: 'Fast and affordable for everyday tasks',
    tier: '$',
    capabilities: ['vision', 'tools'],
  },
  // Google
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'google',
    tagline: 'Long context and multimodal reasoning',
    tier: '$$$',
    capabilities: ['vision', 'web', 'reasoning', 'tools'],
  },
  // Meta
  {
    id: 'llama-4-maverick',
    name: 'Llama 4 Maverick',
    provider: 'meta',
    tagline: 'Open weights, large context',
    tier: '$$',
    capabilities: ['tools'],
  },
  // Mistral
  {
    id: 'mistral-large-2',
    name: 'Mistral Large 2',
    provider: 'mistral',
    tagline: 'European-built frontier-class model',
    tier: '$$',
    capabilities: ['tools'],
  },
  // Moonshot
  {
    id: 'kimi-k2-0905',
    name: 'Kimi K2 (0905)',
    provider: 'moonshot',
    tagline: 'Long-context generalist from Moonshot',
    tier: '$$',
    capabilities: ['web', 'tools'],
  },
  // DeepSeek
  {
    id: 'deepseek-v3.5',
    name: 'DeepSeek V3.5',
    provider: 'deepseek',
    tagline: 'Strong reasoning at low cost',
    tier: '$',
    capabilities: ['reasoning', 'tools'],
  },
  // xAI
  {
    id: 'grok-4',
    name: 'Grok 4',
    provider: 'xai',
    tagline: 'Real-time web access',
    tier: '$$$',
    capabilities: ['web', 'tools'],
  },
  // Legacy
  {
    id: 'claude-sonnet-3-7',
    name: 'Claude Sonnet 3.7',
    provider: 'anthropic',
    tagline: 'Previous-generation Sonnet',
    tier: '$$',
    capabilities: ['vision', 'tools'],
    legacy: true,
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    tagline: 'Previous-generation multimodal',
    tier: '$$',
    capabilities: ['vision', 'tools'],
    legacy: true,
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'google',
    tagline: 'Previous-generation Pro',
    tier: '$$',
    capabilities: ['vision', 'tools'],
    legacy: true,
  },
];

export const PROVIDER_LABEL: Record<ModelProvider, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
  meta: 'Meta',
  mistral: 'Mistral',
  moonshot: 'Moonshot',
  deepseek: 'DeepSeek',
  xai: 'xAI',
};

/** Single-letter mark for the left-rail provider strip. */
export const PROVIDER_MARK: Record<ModelProvider, string> = {
  anthropic: 'A',
  openai: 'O',
  google: 'G',
  meta: 'M',
  mistral: '◆',
  moonshot: '☾',
  deepseek: '◐',
  xai: '𝕏',
};

export function getDefaultModel(): ModelEntry {
  return MODELS.find((m) => m.starred) ?? MODELS[0];
}

export function getModel(id: string): ModelEntry | undefined {
  return MODELS.find((m) => m.id === id);
}
