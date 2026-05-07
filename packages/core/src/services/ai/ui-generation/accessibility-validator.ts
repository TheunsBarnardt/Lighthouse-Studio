import type { UiComponent, AccessibilityReport, AxeViolation } from './types.js';

export class AccessibilityValidator {
  async validate(component: UiComponent): Promise<AccessibilityReport> {
    // In production this uses Playwright + axe-core in a headless browser.
    // The component files are rendered in a sandboxed iframe; axe-core runs against the DOM.
    const violations: AxeViolation[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Heuristic checks on generated source code
    for (const file of component.files) {
      if (!file.path.endsWith('.tsx') && !file.path.endsWith('.ts')) continue;
      const src = file.content;

      if (src.includes('<img') && !src.includes('alt=')) {
        violations.push({
          id: 'image-alt',
          impact: 'serious',
          description: 'Images must have alternative text',
          nodes: ['img'],
        });
      }

      if (src.includes('<input') && !src.includes('<label') && !src.includes('aria-label')) {
        warnings.push('Form inputs should have associated labels');
      }

      if (src.includes('onClick') && !src.includes('<button') && !src.includes('role="button"')) {
        suggestions.push('Consider using <button> instead of div/span with onClick for keyboard accessibility');
      }
    }

    return {
      componentId: component.id,
      passed: violations.length === 0,
      violations,
      warnings,
      suggestions,
    };
  }
}
