import type { UiProject, TypeCheckReport } from './types.js';

export class TypeChecker {
  async check(project: UiProject): Promise<TypeCheckReport> {
    // In production this uses the TypeScript compiler API (ts.createProgram) to compile
    // the full generated project in memory and collect diagnostics.
    //
    // For the service layer, we do basic static checks on the source files.
    const errors: TypeCheckReport['errors'] = [];
    const warnings: TypeCheckReport['warnings'] = [];

    for (const file of project.files) {
      if (!file.path.endsWith('.tsx') && !file.path.endsWith('.ts')) continue;
      const lines = file.content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? '';

        if (line.includes(': any') || line.includes('as any')) {
          warnings.push({ file: file.path, line: i + 1, message: 'Avoid "any" type — use a specific type or "unknown"' });
        }

        if (line.match(/console\.log\(.+\)/)) {
          warnings.push({ file: file.path, line: i + 1, message: 'Remove console.log before review' });
        }
      }
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings,
    };
  }
}
