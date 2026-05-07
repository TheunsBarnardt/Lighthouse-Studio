// ── Data Browser permission actions ──────────────────────────────────────────
// Default role grants:
//   workspace_owner, workspace_admin : all browser.* permissions
//   architect, developer             : browser.read, browser.write, browser.import, browser.export
//   qa, reviewer                     : browser.read, browser.export
//   viewer                           : browser.read

export const BROWSER_PERMISSIONS = {
  /** View rows in the data browser. */
  READ: 'browser.read',
  /** Inline edit and bulk operations in the data browser. */
  WRITE: 'browser.write',
  /** Import CSV/JSON files. */
  IMPORT: 'browser.import',
  /** Export CSV/JSON files. */
  EXPORT: 'browser.export',
  /** Create, update, delete saved views. */
  MANAGE_VIEWS: 'browser.manage_views',
  /** Share saved views workspace-wide. */
  SHARE_VIEWS: 'browser.share_views',
} as const;

export type BrowserPermission = (typeof BROWSER_PERMISSIONS)[keyof typeof BROWSER_PERMISSIONS];

// ── Tunable limits ────────────────────────────────────────────────────────────

export const BROWSER_DEFAULTS = {
  PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 500,
  MAX_IMPORT_ROWS: 100_000,
  FK_CACHE_TTL_MS: 30_000,
  PERMISSION_CACHE_TTL_MS: 30_000,
  EXPORT_MAX_SIZE_BYTES: 1_073_741_824, // 1 GB
  SIGNED_URL_TTL_DAYS: 7,
} as const;
