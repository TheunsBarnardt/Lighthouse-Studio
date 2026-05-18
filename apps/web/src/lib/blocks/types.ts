/**
 * Types for the platform Blocks Library.
 *
 * A "block" is a pre-built UI pattern (Hero, CTA, Pricing, Auth form, etc.)
 * that users can preview in `/blocks`, drag into the UI generation iframe,
 * and bind to real schema data after placement.
 *
 * Blocks are **global** (not workspace-scoped) — they form the platform's
 * shared design vocabulary. Workspaces customize the brand (per ADR-0279);
 * blocks define the structural patterns the brand is applied to.
 *
 * Referenced by master-plan.md line 143 and Objective 26.5 §3 (chrome blocks
 * are a Blocks Library category).
 */

import type { ReactNode } from 'react';

export type BlockCategory =
  | 'hero'
  | 'cta'
  | 'features'
  | 'pricing'
  | 'testimonial'
  | 'stats'
  | 'auth'
  | 'form'
  | 'header'
  | 'footer'
  | 'table'
  | 'dashboard';

export interface BlockMeta {
  /** Stable slug-style id, used in routes (`/blocks/<id>`, `/preview/blocks/<id>`). */
  id: string;
  /** Display name in the gallery. */
  name: string;
  category: BlockCategory;
  /** One-line description shown under the name. */
  tagline: string;
  /**
   * Logical placeholder fields that can be bound to schema entities in Phase 3.
   * Keys are surfaced in the inspector; values are the default placeholder text.
   */
  placeholders?: Record<string, string>;
  /** Marked NEW in the gallery for ~7 days after authoring (display-only). */
  isNew?: boolean;
}

export interface BlockDefinition extends BlockMeta {
  /** The actual JSX renderer. Plain Tailwind only; no external assets. */
  render: () => ReactNode;
}

export const BLOCK_CATEGORIES: { id: BlockCategory; label: string; description: string }[] = [
  { id: 'hero', label: 'Hero', description: 'Top-of-page anchors' },
  { id: 'cta', label: 'CTA', description: 'Call-to-action sections' },
  { id: 'features', label: 'Features', description: 'Feature grids and lists' },
  { id: 'pricing', label: 'Pricing', description: 'Pricing tables' },
  { id: 'testimonial', label: 'Testimonial', description: 'Quotes and reviews' },
  { id: 'stats', label: 'Stats', description: 'Metric rows and KPI cards' },
  { id: 'auth', label: 'Auth', description: 'Sign-in and sign-up forms' },
  { id: 'form', label: 'Form', description: 'Contact and input forms' },
  { id: 'header', label: 'Header (Chrome)', description: 'Top navigation' },
  { id: 'footer', label: 'Footer (Chrome)', description: 'Page footers' },
  { id: 'table', label: 'Table', description: 'Data tables' },
  { id: 'dashboard', label: 'Dashboard', description: 'Dashboard layouts' },
];
