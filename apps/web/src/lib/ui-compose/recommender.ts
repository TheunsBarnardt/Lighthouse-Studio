/**
 * Heuristic UI composition recommender.
 *
 * Given a free-text brief (and optionally an existing composition), picks
 * which blocks from the Blocks Library to assemble + suggests placeholder text
 * overrides for the top-level fields.
 *
 * This is a *deterministic* stand-in for the eventual LLM-driven composer.
 * The compose endpoint streams events in exactly the same shape the LLM call
 * will, so the front-end UX is final; only the recommender body swaps out
 * when the AI wiring lands (one drop-in change, see ADR-0285).
 *
 * Design: small keyword index → block ids. Multiple keyword hits per category
 * are de-duplicated. Order in the output matches a sensible page flow (chrome
 * → hero → body sections → footer chrome).
 */

import type { BlockDefinition } from '@/lib/blocks/types';

import { BLOCKS, getBlock } from '@/lib/blocks/registry';

const KEYWORD_INTENTS: { match: RegExp; blocks: string[] }[] = [
  // Domain shapes
  {
    match: /\b(crm|contact|lead|deal|pipeline|sales)\b/i,
    blocks: ['header-with-nav', 'dashboard-stats-cards', 'table-simple', 'footer-4col'],
  },
  {
    match: /\b(dashboard|admin|metrics|analytics|reporting|kpi)\b/i,
    blocks: ['header-with-nav', 'dashboard-stats-cards', 'table-simple'],
  },
  {
    match: /\b(marketing|landing|homepage|home page|brochure)\b/i,
    blocks: [
      'header-with-nav',
      'hero-centered',
      'feature-grid-3col',
      'testimonial-quote',
      'cta-simple',
      'footer-4col',
    ],
  },
  {
    match: /\b(saas|product|launch|platform)\b/i,
    blocks: [
      'header-with-nav',
      'hero-split',
      'feature-grid-3col',
      'stats-row',
      'pricing-3tier',
      'cta-simple',
      'footer-4col',
    ],
  },
  {
    match: /\b(pricing|plan|subscription|tier)\b/i,
    blocks: ['header-with-nav', 'hero-centered', 'pricing-3tier', 'footer-4col'],
  },
  {
    match: /\b(testimonial|review|case study|customer)\b/i,
    blocks: ['testimonial-quote'],
  },
  // Auth flows
  {
    match: /\b(sign in|signin|login|log in)\b/i,
    blocks: ['auth-signin'],
  },
  {
    match: /\b(sign up|signup|register|onboard)\b/i,
    blocks: ['auth-signup'],
  },
  // Forms
  {
    match: /\b(contact form|get in touch|support|inquiry|enquiry)\b/i,
    blocks: ['contact-form'],
  },
  // Generic structural hints
  {
    match: /\b(table|list|grid|directory)\b/i,
    blocks: ['table-simple'],
  },
  {
    match: /\b(hero|headline|above the fold)\b/i,
    blocks: ['hero-centered'],
  },
  {
    match: /\b(call to action|cta|conversion)\b/i,
    blocks: ['cta-simple'],
  },
  {
    match: /\b(feature|highlight|benefit)\b/i,
    blocks: ['feature-grid-3col'],
  },
  {
    match: /\b(stat|metric|number|usage|growth)\b/i,
    blocks: ['stats-row'],
  },
];

const DEFAULT_BLOCKS = [
  'header-with-nav',
  'hero-centered',
  'feature-grid-3col',
  'cta-simple',
  'footer-4col',
];

const FLOW_ORDER: string[] = [
  // chrome top
  'header-with-nav',
  // attention
  'hero-centered',
  'hero-split',
  // proof + features
  'stats-row',
  'feature-grid-3col',
  'testimonial-quote',
  // conversion
  'pricing-3tier',
  'cta-simple',
  // auth (single-purpose pages mostly stand alone)
  'auth-signin',
  'auth-signup',
  // utility
  'contact-form',
  'table-simple',
  'dashboard-stats-cards',
  // chrome bottom
  'footer-4col',
];

export interface UiComposition {
  /** Ordered list of block ids to insert. */
  blockIds: string[];
  /** Short one-line reasoning shown in the chat. */
  reasoning: string;
  /** Suggested placeholder overrides per block id (Phase 3 will bind these to schema). */
  placeholders: Record<string, Record<string, string>>;
}

/**
 * Pick a composition for a brief.
 *
 * Pure function — same input always yields same output. Suitable for
 * server-side execution.
 */
export function recommendComposition(brief: string): UiComposition {
  const text = brief.trim();
  const matches: Set<string> = new Set();

  if (text.length === 0) {
    for (const id of DEFAULT_BLOCKS) matches.add(id);
  } else {
    for (const { match, blocks } of KEYWORD_INTENTS) {
      if (match.test(text)) {
        for (const id of blocks) matches.add(id);
      }
    }
    if (matches.size === 0) {
      for (const id of DEFAULT_BLOCKS) matches.add(id);
    }
  }

  // Sort matches by FLOW_ORDER so the page reads top-to-bottom sensibly.
  const orderIndex = (id: string) => {
    const i = FLOW_ORDER.indexOf(id);
    return i === -1 ? FLOW_ORDER.length : i;
  };
  const orderedIds = [...matches].sort((a, b) => orderIndex(a) - orderIndex(b));

  // Suggest a few placeholder overrides based on the brief.
  const placeholders: Record<string, Record<string, string>> = {};
  const inferredTitle = inferTitle(text);
  const inferredSubtitle = inferSubtitle(text);
  for (const id of orderedIds) {
    const block = getBlock(id);
    if (!block?.placeholders) continue;
    const overrides: Record<string, string> = {};
    if ('title' in block.placeholders && inferredTitle) overrides['title'] = inferredTitle;
    if ('subtitle' in block.placeholders && inferredSubtitle)
      overrides['subtitle'] = inferredSubtitle;
    if (Object.keys(overrides).length > 0) placeholders[id] = overrides;
  }

  return {
    blockIds: orderedIds,
    reasoning: describeReasoning(text, orderedIds),
    placeholders,
  };
}

function inferTitle(brief: string): string | undefined {
  const trimmed = brief.trim();
  if (!trimmed) return undefined;
  // First sentence, truncated.
  const firstSentence = trimmed.split(/[.!?\n]/)[0]?.trim() ?? trimmed;
  if (!firstSentence) return undefined;
  return firstSentence.length > 80 ? `${firstSentence.slice(0, 77)}…` : firstSentence;
}

function inferSubtitle(brief: string): string | undefined {
  const trimmed = brief.trim();
  if (!trimmed) return undefined;
  const sentences = trimmed
    .split(/[.!?\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length < 2) return undefined;
  const second = sentences[1];
  return second.length > 140 ? `${second.slice(0, 137)}…` : second;
}

function describeReasoning(brief: string, ids: string[]): string {
  if (brief.trim().length === 0) {
    return `No brief provided — composed a generic landing page from ${ids.length.toString()} default blocks.`;
  }
  const names = ids.map((id) => getBlock(id)?.name).filter((n): n is string => Boolean(n));
  return `Composed ${ids.length.toString()} blocks (${names.slice(0, 3).join(', ')}${names.length > 3 ? '…' : ''}) based on keywords in the brief.`;
}

/** Helper so the API route can validate block ids exist in the registry. */
export function isKnownBlockId(id: string): boolean {
  return BLOCKS.some((b: BlockDefinition) => b.id === id);
}
