import type { ChromeBlock } from './types.js';

export const STARTER_CHROME_BLOCKS: ChromeBlock[] = [
  // ── Headers ──────────────────────────────────────────────────────────────
  {
    id: 'chrome-header-app',
    name: 'App Header',
    description: 'Full-featured app header with logo, primary navigation, search, and user menu.',
    region: 'header',
    kind: 'tailwind',
    builtIn: true,
    params: [
      { name: 'logoUrl', type: 'string', required: false, description: 'URL of the logo image' },
      { name: 'productName', type: 'string', required: true, description: 'Product name shown next to logo' },
      { name: 'showSearch', type: 'boolean', required: false, description: 'Show global search input', default: true },
      { name: 'navItems', type: 'string[]', required: false, description: 'Top-level nav links', default: [] },
      { name: 'userMenuItems', type: 'string[]', required: false, description: 'User menu link labels', default: ['Settings', 'Sign out'] },
    ],
  },
  {
    id: 'chrome-header-marketing',
    name: 'Marketing Header',
    description: 'Public-facing header with logo, marketing nav, and CTA button.',
    region: 'header',
    kind: 'tailwind',
    builtIn: true,
    params: [
      { name: 'logoUrl', type: 'string', required: false, description: 'URL of the logo image' },
      { name: 'productName', type: 'string', required: true, description: 'Product name' },
      { name: 'navItems', type: 'string[]', required: false, description: 'Nav link labels', default: ['Features', 'Pricing', 'Docs'] },
      { name: 'ctaLabel', type: 'string', required: false, description: 'CTA button label', default: 'Get started' },
      { name: 'ctaHref', type: 'string', required: false, description: 'CTA button URL', default: '/sign-up' },
    ],
  },
  {
    id: 'chrome-header-minimal',
    name: 'Minimal Header',
    description: 'Slim header with logo only — good for auth pages or embedded flows.',
    region: 'header',
    kind: 'tailwind',
    builtIn: true,
    params: [
      { name: 'logoUrl', type: 'string', required: false, description: 'URL of the logo image' },
      { name: 'productName', type: 'string', required: true, description: 'Product name' },
    ],
  },

  // ── Side navs ─────────────────────────────────────────────────────────────
  {
    id: 'chrome-sidenav-vertical',
    name: 'Vertical Side Nav',
    description: 'Full-width sidebar with collapsible groups, icons, and labels.',
    region: 'sidenav',
    kind: 'tailwind',
    builtIn: true,
    params: [
      { name: 'items', type: 'object', required: true, description: 'Navigation item tree (label, href, icon, children)' },
      { name: 'collapsible', type: 'boolean', required: false, description: 'Allow sidebar to be collapsed', default: true },
      { name: 'defaultCollapsed', type: 'boolean', required: false, description: 'Start collapsed on first render', default: false },
      { name: 'showWorkspaceSwitcher', type: 'boolean', required: false, description: 'Show workspace selector at the bottom', default: false },
    ],
  },
  {
    id: 'chrome-sidenav-icon-only',
    name: 'Icon-Only Side Nav',
    description: 'Compact sidebar showing only icons with tooltips on hover.',
    region: 'sidenav',
    kind: 'tailwind',
    builtIn: true,
    params: [
      { name: 'items', type: 'object', required: true, description: 'Navigation item tree (label, href, icon)' },
    ],
  },

  // ── Breadcrumbs ──────────────────────────────────────────────────────────
  {
    id: 'chrome-breadcrumb',
    name: 'Standard Breadcrumb',
    description: 'Linear breadcrumb trail derived from the current route.',
    region: 'breadcrumb',
    kind: 'tailwind',
    builtIn: true,
    params: [
      { name: 'separator', type: 'string', required: false, description: 'Separator character or string', default: '/' },
      { name: 'maxDepth', type: 'string', required: false, description: 'Max crumbs shown before ellipsis', default: '4' },
    ],
  },
  {
    id: 'chrome-breadcrumb-tabbed',
    name: 'Tabbed Breadcrumb',
    description: 'Breadcrumb with inline tabs for sub-sections of a detail page.',
    region: 'breadcrumb',
    kind: 'tailwind',
    builtIn: true,
    params: [
      { name: 'separator', type: 'string', required: false, description: 'Separator character', default: '›' },
      { name: 'tabs', type: 'string[]', required: false, description: 'Tab labels (resolved from route)', default: [] },
    ],
  },

  // ── Footers ──────────────────────────────────────────────────────────────
  {
    id: 'chrome-footer-standard',
    name: 'Standard Footer',
    description: 'Multi-column footer with link groups, copyright, and social icons.',
    region: 'footer',
    kind: 'tailwind',
    builtIn: true,
    params: [
      { name: 'productName', type: 'string', required: true, description: 'Product name for copyright line' },
      { name: 'linkGroups', type: 'object', required: false, description: 'Columns of footer links [{title, links:[{label,href}]}]', default: [] },
      { name: 'showSocial', type: 'boolean', required: false, description: 'Show social media icons', default: false },
    ],
  },
  {
    id: 'chrome-footer-minimal',
    name: 'Minimal Footer',
    description: 'Single-line footer with copyright text and a few links.',
    region: 'footer',
    kind: 'tailwind',
    builtIn: true,
    params: [
      { name: 'productName', type: 'string', required: true, description: 'Product name for copyright line' },
      { name: 'links', type: 'string[]', required: false, description: 'Footer link labels (Privacy, Terms, etc.)', default: ['Privacy', 'Terms'] },
    ],
  },
];

export function getChromeBlocksForRegion(region: string): ChromeBlock[] {
  return STARTER_CHROME_BLOCKS.filter(b => b.region === region);
}

export function getChromeBlockById(id: string): ChromeBlock | undefined {
  return STARTER_CHROME_BLOCKS.find(b => b.id === id);
}
