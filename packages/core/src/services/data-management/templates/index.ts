import type { CustomerTableDefinition } from '../schema-model.js';

// ── Schema template types ─────────────────────────────────────────────────────

export interface SchemaTemplate {
  id: string;
  name: string;
  description: string;
  /** Tables included in this template. IDs are stable template identifiers. */
  tables: CustomerTableDefinition[];
}

// ── Template registry ─────────────────────────────────────────────────────────

import { blankTemplate } from './blank.js';
import { blogTemplate } from './blog.js';
import { crmTemplate } from './crm.js';
import { ecommerceTemplate } from './ecommerce.js';
import { taskTrackerTemplate } from './task-tracker.js';

const TEMPLATES: SchemaTemplate[] = [
  blankTemplate,
  crmTemplate,
  blogTemplate,
  taskTrackerTemplate,
  ecommerceTemplate,
];

export function listTemplates(): SchemaTemplate[] {
  return TEMPLATES;
}

export function getTemplate(id: string): SchemaTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
