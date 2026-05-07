import type { PrdTemplate } from '../types.js';

import { blogTemplate } from './blog.template.js';
import { crmTemplate } from './crm.template.js';
import { customerPortalTemplate } from './customer-portal.template.js';
import { dashboardTemplate } from './dashboard.template.js';
import { eCommerceTemplate } from './e-commerce.template.js';
import { internalToolTemplate } from './internal-tool.template.js';

/**
 * The complete set of built-in PRD templates shipped with the platform.
 * These are hint-based starter structures; the AI adapts them to the actual
 * intent brief content. They are not constraints.
 *
 * To add a new built-in template:
 *   1. Create a new `<name>.template.ts` in this directory.
 *   2. Import it below and add it to BUILTIN_TEMPLATES.
 *   3. Write a brief section in the PRD generation user guide.
 */
export const BUILTIN_TEMPLATES: PrdTemplate[] = [
  crmTemplate,
  blogTemplate,
  internalToolTemplate,
  customerPortalTemplate,
  dashboardTemplate,
  eCommerceTemplate,
];

/**
 * Look up a built-in template by its ID.
 * Returns `undefined` if no built-in template with that ID exists.
 */
export function getBuiltinTemplate(id: string): PrdTemplate | undefined {
  return BUILTIN_TEMPLATES.find((t) => t.id === id);
}

export {
  blogTemplate,
  crmTemplate,
  customerPortalTemplate,
  dashboardTemplate,
  eCommerceTemplate,
  internalToolTemplate,
};
