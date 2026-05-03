/**
 * Accessibility audit — Foundation pages
 *
 * Runs axe-core against every foundation page.
 * Fails on any "serious" or "critical" severity violation.
 * "Minor" violations are logged but do not fail the build.
 *
 * Requires: APP_URL env var pointing to a running platform instance.
 * If APP_URL is not set, the suite skips gracefully.
 *
 * Add pages to FOUNDATION_PAGES as the UI is implemented.
 */

import { describe, expect, it } from 'vitest';

// Foundation pages to audit. Add new pages here as the UI is built.
const FOUNDATION_PAGES = [
  { path: '/auth/sign-in', name: 'Sign In' },
  { path: '/auth/sign-up', name: 'Sign Up' },
  { path: '/workspaces', name: 'Workspace List' },
  { path: '/account/settings', name: 'Account Settings' },
];

const APP_URL = process.env['APP_URL'];

describe('Accessibility: Foundation pages (WCAG 2.2 AA)', () => {
  if (!APP_URL) {
    it.skip('skipping — APP_URL not set (set APP_URL=http://localhost:3000 to run)', () => {
      // no-op
    });
    return;
  }

  for (const page of FOUNDATION_PAGES) {
    describe(page.name, () => {
      it(`has no critical or serious axe-core violations on ${page.path}`, async () => {
        // Dynamic imports so axe-core/playwright are optional deps
        const { chromium } = await import('playwright').catch(() => {
          throw new Error(
            'playwright is not installed. Run: pnpm add -D playwright @axe-core/playwright',
          );
        });
        const { checkA11y } = await import('axe-playwright').catch(() => {
          throw new Error('axe-playwright is not installed. Run: pnpm add -D axe-playwright');
        });

        const browser = await chromium.launch();
        const page_ = await browser.newPage();

        try {
          const response = await page_.goto(`${APP_URL}${page.path}`, {
            waitUntil: 'networkidle',
            timeout: 30_000,
          });

          if (!response || response.status() === 404) {
            console.log(`  Page ${page.path} returned 404 — skipping (not yet implemented)`);
            return;
          }

          // Run axe-core — throws when violations are found; caught below
          await checkA11y(page_, undefined, {
            detailedReport: true,
            detailedReportOptions: { html: true },
          });

          // If we get here, no violations
          console.log(`  ✓ ${page.name}: no violations`);
        } catch (e) {
          const err = e as {
            violations?: Array<{ impact: string; id: string; description: string }>;
          };
          if (err.violations) {
            const critical = err.violations.filter((v) => v.impact === 'critical');
            const serious = err.violations.filter((v) => v.impact === 'serious');
            const minor = err.violations.filter(
              (v) => v.impact !== 'critical' && v.impact !== 'serious',
            );

            if (minor.length > 0) {
              console.warn(
                `  ⚠ ${page.name}: ${minor.length} minor violations (logged, not failing):`,
              );
              for (const v of minor) {
                console.warn(`    - ${v.id}: ${v.description}`);
              }
            }

            if (critical.length > 0 || serious.length > 0) {
              const blocking = [...critical, ...serious];
              console.error(`  ✗ ${page.name}: ${blocking.length} blocking violations:`);
              for (const v of blocking) {
                console.error(`    [${v.impact}] ${v.id}: ${v.description}`);
              }
              expect.fail(
                `${page.name} has ${critical.length} critical and ${serious.length} serious accessibility violations. ` +
                  `See output above for details.`,
              );
            }
          } else {
            throw e;
          }
        } finally {
          await browser.close();
        }
      });
    });
  }
});
