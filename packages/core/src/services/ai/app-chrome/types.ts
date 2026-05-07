import { z } from 'zod';

// ─── Chrome regions and layouts ───────────────────────────────────────────────

export type ChromeRegion = 'header' | 'sidenav' | 'breadcrumb' | 'footer';
export type ChromeLayout = 'sidenav-with-topbar' | 'topnav-only' | 'full-page';

// ─── Chrome blocks ─────────────────────────────────────────────────────────

export interface ChromeBlockParam {
  name: string;
  type: 'string' | 'boolean' | 'string[]' | 'object';
  required: boolean;
  description: string;
  default?: unknown;
}

export interface ChromeBlock {
  id: string;
  name: string;
  description: string;
  region: ChromeRegion;
  kind: 'tailwind' | 'custom';
  params: ChromeBlockParam[];
  previewImageUrl?: string;
  builtIn: boolean;
}

// ─── Chrome configuration ─────────────────────────────────────────────────────

export interface ChromeRegionConfig {
  blockId: string;
  params: Record<string, unknown>;
}

export interface PageChromeOverride {
  pageId: string;
  pagePath: string;
  layout?: ChromeLayout | 'none';
  header?: string | 'none';
  sidenav?: string | 'none';
  breadcrumb?: string | 'none';
  footer?: string | 'none';
}

export interface AppChromeConfig {
  id: string;
  projectId: string;
  workspaceId: string;
  layout: ChromeLayout;
  header?: ChromeRegionConfig;
  sidenav?: ChromeRegionConfig;
  breadcrumb?: ChromeRegionConfig;
  footer?: ChromeRegionConfig;
  pageOverrides: PageChromeOverride[];
  createdAt: Date;
  updatedAt: Date;
}

// ─── AI Chrome proposal ──────────────────────────────────────────────────────

export interface ChromeProposalRegion {
  blockId: string;
  params: Record<string, unknown>;
  reasoning: string;
}

export interface ChromeProposal {
  suggestedLayout: ChromeLayout;
  header: ChromeProposalRegion;
  sidenav?: ChromeProposalRegion;
  breadcrumb?: ChromeProposalRegion;
  footer?: ChromeProposalRegion;
  pageOverrides: PageChromeOverride[];
  overallReasoning: string;
}

// ─── Input schemas ────────────────────────────────────────────────────────────

export const UpdateChromeConfigInputSchema = z.object({
  projectId: z.string().min(1),
  layout: z.enum(['sidenav-with-topbar', 'topnav-only', 'full-page']).optional(),
  header: z.object({ blockId: z.string(), params: z.record(z.unknown()) }).optional(),
  sidenav: z.object({ blockId: z.string(), params: z.record(z.unknown()) }).optional(),
  breadcrumb: z.object({ blockId: z.string(), params: z.record(z.unknown()) }).optional(),
  footer: z.object({ blockId: z.string(), params: z.record(z.unknown()) }).optional(),
  pageOverrides: z.array(z.object({
    pageId: z.string(),
    pagePath: z.string(),
    layout: z.enum(['sidenav-with-topbar', 'topnav-only', 'full-page', 'none']).optional(),
    header: z.string().optional(),
    sidenav: z.string().optional(),
    breadcrumb: z.string().optional(),
    footer: z.string().optional(),
  })).optional(),
});
export type UpdateChromeConfigInput = z.infer<typeof UpdateChromeConfigInputSchema>;

export const ProposeChromInputSchema = z.object({
  projectId: z.string().min(1),
  prdContent: z.string().min(1),
  brandPrimary: z.string().optional(),
  brandName: z.string().optional(),
});
export type ProposeChromeInput = z.infer<typeof ProposeChromInputSchema>;

export const ApplyChromeProposalInputSchema = z.object({
  projectId: z.string().min(1),
  proposal: z.object({
    suggestedLayout: z.enum(['sidenav-with-topbar', 'topnav-only', 'full-page']),
    header: z.object({ blockId: z.string(), params: z.record(z.unknown()), reasoning: z.string() }),
    sidenav: z.object({ blockId: z.string(), params: z.record(z.unknown()), reasoning: z.string() }).optional(),
    breadcrumb: z.object({ blockId: z.string(), params: z.record(z.unknown()), reasoning: z.string() }).optional(),
    footer: z.object({ blockId: z.string(), params: z.record(z.unknown()), reasoning: z.string() }).optional(),
    pageOverrides: z.array(z.object({
      pageId: z.string(),
      pagePath: z.string(),
      layout: z.string().optional(),
      header: z.string().optional(),
      sidenav: z.string().optional(),
      breadcrumb: z.string().optional(),
      footer: z.string().optional(),
    })),
    overallReasoning: z.string(),
  }),
});
export type ApplyChromeProposalInput = z.infer<typeof ApplyChromeProposalInputSchema>;

// ─── Audit events ─────────────────────────────────────────────────────────────

export const APP_CHROME_AUDIT_EVENTS = {
  CONFIG_UPDATED: 'app_chrome.config_updated',
  CONFIG_RESET: 'app_chrome.config_reset',
  PROPOSAL_GENERATED: 'app_chrome.proposal_generated',
  PROPOSAL_APPLIED: 'app_chrome.proposal_applied',
  PAGE_OVERRIDE_SET: 'app_chrome.page_override_set',
} as const;

export type AppChromeAuditEventType = typeof APP_CHROME_AUDIT_EVENTS[keyof typeof APP_CHROME_AUDIT_EVENTS];

// ─── Permissions ──────────────────────────────────────────────────────────────

export const APP_CHROME_PERMISSIONS = {
  VIEW: 'app_chrome.view',
  CONFIGURE: 'app_chrome.configure',
  PROPOSE: 'app_chrome.propose',
} as const;

export const APP_CHROME_DEFAULT_GRANTS = {
  admin: ['app_chrome.view', 'app_chrome.configure', 'app_chrome.propose'],
  editor: ['app_chrome.view', 'app_chrome.configure'],
  viewer: ['app_chrome.view'],
} as const;
